
/* IMPORT */

import * as vscode from 'vscode';
import Config from '../config';
import DecorationTypes from './decorators/decoration_types';
import Utils from '../utils';

/* DECORATION TYPES */

const DIMMED = DecorationTypes.lazy ( () => vscode.window.createTextEditorDecorationType ({
  opacity: Config.getKey ( 'filter.opacity' ),
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}));

/* FILTER */

// Filters the document in place: lines that don't match get dimmed and, when possible, folded away

const Filter = {

  queries: {} as { [uri: string]: string },
  statusbar: undefined as vscode.StatusBarItem,
  foldingRangesEvent: new vscode.EventEmitter<void> (),
  historyKey: 'filter.history',
  historyLength: 10,

  /* API */

  get ( textDocument: vscode.TextDocument ): string | undefined {

    return Filter.queries[textDocument.uri.toString ()];

  },

  async set ( textEditor: vscode.TextEditor, query: string | undefined ) {

    const uri = textEditor.document.uri.toString (),
          fold = Config.getKey ( 'filter.fold' ) !== false;

    if ( query ) {
      Filter.queries[uri] = query;
    } else {
      delete Filter.queries[uri];
    }

    Filter.decorate ( textEditor );
    Filter.updateStatusbar ();

    if ( fold || !query ) {
      await vscode.commands.executeCommand ( 'editor.unfoldAll' );
    }

    Filter.foldingRangesEvent.fire ();

    if ( !query || !fold ) return;

    const selectionLines = Filter.getFoldingRanges ( textEditor.document ).map ( range => range.start );

    for ( const delay of [250, 750] ) { // Waiting for VS Code to pick up the new folding ranges
      await new Promise ( resolve => setTimeout ( resolve, delay ) );
      if ( vscode.window.activeTextEditor !== textEditor ) return;
      await vscode.commands.executeCommand ( 'editor.fold', { selectionLines } );
    }

  },

  /* DECORATIONS */

  decorate ( textEditor: vscode.TextEditor ) {

    const query = Filter.get ( textEditor.document );

    if ( !query ) return textEditor.setDecorations ( DIMMED (), [] );

    const textDocument = textEditor.document,
          visible = Utils.filter.getVisibleLines ( textDocument, query ),
          ranges: vscode.Range[] = [];

    for ( let lineNr = 0; lineNr < textDocument.lineCount; lineNr++ ) {
      if ( visible.has ( lineNr ) ) continue;
      ranges.push ( textDocument.lineAt ( lineNr ).range );
    }

    textEditor.setDecorations ( DIMMED (), ranges );

  },

  decorateAll () {

    vscode.window.visibleTextEditors.forEach ( Filter.decorate );

  },

  /* FOLDING */

  getFoldingRanges ( textDocument: vscode.TextDocument ): vscode.FoldingRange[] {

    const query = Filter.get ( textDocument );

    return query && Config.getKey ( 'filter.fold' ) !== false ? Filter.getFilterRanges ( textDocument, query ) : Filter.getIndentationRanges ( textDocument );

  },

  getFilterRanges ( textDocument: vscode.TextDocument, query: string ) { // Every run of hidden lines folds under the visible line above it

    const visible = Utils.filter.getVisibleLines ( textDocument, query ),
          ranges: vscode.FoldingRange[] = [];

    let start = -1;

    for ( let lineNr = 0; lineNr <= textDocument.lineCount; lineNr++ ) {

      const hidden = lineNr < textDocument.lineCount && !visible.has ( lineNr );

      if ( hidden && start < 0 ) start = lineNr;

      if ( !hidden && start >= 0 ) {
        ranges.push ( new vscode.FoldingRange ( Math.max ( 0, start - 1 ), lineNr - 1 ) );
        start = -1;
      }

    }

    return ranges.filter ( range => range.end > range.start );

  },

  getIndentationRanges ( textDocument: vscode.TextDocument ) { // Same as VS Code's own indentation-based folding, which our provider replaces

    const ranges: vscode.FoldingRange[] = [],
          stack: { lineNr: number, level: number }[] = [];

    let lastLineNr = -1;

    const close = ( level: number ) => {
      while ( stack.length && stack[stack.length - 1].level >= level ) {
        const {lineNr} = stack.pop ();
        if ( lastLineNr > lineNr ) ranges.push ( new vscode.FoldingRange ( lineNr, lastLineNr ) );
      }
    };

    for ( let lineNr = 0; lineNr < textDocument.lineCount; lineNr++ ) {

      const {text} = textDocument.lineAt ( lineNr );

      if ( !text.trim () ) continue;

      const level = Utils.ast.getLevel ( textDocument, text );

      close ( level );

      stack.push ({ lineNr, level });
      lastLineNr = lineNr;

    }

    close ( -1 );

    return ranges.sort ( ( a, b ) => a.start - b.start );

  },

  /* STATUSBAR */

  updateStatusbar () {

    const textEditor = vscode.window.activeTextEditor,
          query = textEditor && Filter.get ( textEditor.document );

    if ( !Filter.statusbar ) {
      Filter.statusbar = vscode.window.createStatusBarItem ( vscode.StatusBarAlignment.Left, -2 );
      Filter.statusbar.command = 'todo.clearFilter';
      Filter.statusbar.tooltip = 'Clear the filter';
    }

    if ( query ) {
      Filter.statusbar.text = `$(filter) ${query}`;
      Filter.statusbar.show ();
    } else {
      Filter.statusbar.hide ();
    }

  },

  /* HISTORY */

  getHistory (): string[] {

    return Utils.context.globalState.get ( Filter.historyKey, [] );

  },

  addHistory ( query: string ) {

    const history = [query, ...Filter.getHistory ().filter ( prev => prev !== query )].slice ( 0, Filter.historyLength );

    Utils.context.globalState.update ( Filter.historyKey, history );

  },

  /* PROMPT */

  prompt ( value: string ): Promise<string | undefined> { // Free input, with recent filters to pick from

    return new Promise ( resolve => {

      const quickPick = vscode.window.createQuickPick (),
            history = Filter.getHistory ();

      const setItems = () => {
        const typed = quickPick.value.trim ();
        quickPick.items = ( typed ? [typed] : [] ).concat ( history.filter ( query => query !== typed ) ).map ( label => ({ label, alwaysShow: label === typed }) );
      };

      quickPick.placeholder = 'Spaces: all terms, commas: any of them, !: negation — @now @high, @now,@tomorrow, !@xl, text. Empty clears';
      quickPick.value = value;
      setItems ();

      quickPick.onDidChangeValue ( setItems );
      quickPick.onDidAccept ( () => {
        const [selected] = quickPick.selectedItems;
        resolve ( ( selected ? selected.label : quickPick.value ).trim () );
        quickPick.hide ();
      });
      quickPick.onDidHide ( () => {
        resolve ( undefined );
        quickPick.dispose ();
      });

      quickPick.show ();

    });

  },

  /* INIT */

  init ( context: vscode.ExtensionContext ) {

    const refresh = ( textDocument: vscode.TextDocument ) => {
      if ( !Filter.get ( textDocument ) ) return;
      vscode.window.visibleTextEditors.filter ( textEditor => textEditor.document === textDocument ).forEach ( Filter.decorate );
    };

    context.subscriptions.push (
      vscode.languages.registerFoldingRangeProvider ( 'todo', {
        onDidChangeFoldingRanges: Filter.foldingRangesEvent.event,
        provideFoldingRanges: Filter.getFoldingRanges
      }),
      vscode.workspace.onDidChangeTextDocument ( event => refresh ( event.document ) ),
      vscode.window.onDidChangeVisibleTextEditors ( Filter.decorateAll ),
      vscode.window.onDidChangeActiveTextEditor ( Filter.updateStatusbar ),
      vscode.workspace.onDidChangeConfiguration ( Filter.decorateAll ), // Decoration types might have been recreated
      vscode.workspace.onDidCloseTextDocument ( textDocument => delete Filter.queries[textDocument.uri.toString ()] )
    );

  }

};

/* EXPORT */

export default Filter;
