
/* IMPORT */

import * as vscode from 'vscode';
import Consts from '../consts';
import AST from './ast';

/* FILTER */

// Query syntax:
// - Space-separated terms must all match: `@now @high`
// - Comma-separated alternatives inside a term are OR-ed: `@now,@tomorrow`
// - `!` negates a term: `!@xl`
// - `@tag` matches a tag, `@done` and `@cancelled` also match todos finished by their symbol
// - Anything else matches the todo text, case-insensitively

const Filter = {

  tagRe: /(?:^|[^a-zA-Z0-9`])@([^\s*~(]+)/g,

  parse ( query: string ) {

    return query.trim ().split ( /\s+/ ).map ( term => {

      const negated = term.startsWith ( '!' ),
            alternatives = ( negated ? term.slice ( 1 ) : term ).toLowerCase ().split ( ',' ).filter ( Boolean );

      return { negated, alternatives };

    }).filter ( term => term.alternatives.length );

  },

  getTags ( text: string ) {

    const tags = new Set<string> ();

    Filter.tagRe.lastIndex = 0;

    let match;

    while ( match = Filter.tagRe.exec ( text ) ) {
      tags.add ( match[1].toLowerCase () );
    }

    if ( new RegExp ( Consts.regexes.todoDone.source ).test ( text ) ) tags.add ( 'done' );
    if ( new RegExp ( Consts.regexes.todoCancelled.source ).test ( text ) ) tags.add ( 'cancelled' );

    return tags;

  },

  isMatch ( text: string, terms ) {

    const tags = Filter.getTags ( text ),
          lower = text.toLowerCase ();

    return terms.every ( ({ negated, alternatives }) => {

      const matched = alternatives.some ( alt => alt.startsWith ( '@' ) ? tags.has ( alt.slice ( 1 ) ) : lower.includes ( alt ) );

      return matched !== negated;

    });

  },

  cache: {}, // filePath => { version, query, lines }

  getVisibleLines ( textDocument: vscode.TextDocument, query: string ): Set<number> { // Matching todos, their ancestors and their details

    const cached = Filter.cache[textDocument.fileName];

    if ( cached && cached.version === textDocument.version && cached.query === query ) return cached.lines;

    const terms = Filter.parse ( query ),
          todoRe = new RegExp ( Consts.regexes.todoSymbol.source ),
          lines = new Set<number> (),
          stack: { lineNr: number, level: number, matched: boolean }[] = [];

    for ( let lineNr = 0; lineNr < textDocument.lineCount; lineNr++ ) {

      const {text} = textDocument.lineAt ( lineNr );

      if ( Consts.regexes.empty.test ( text ) ) continue;

      const level = AST.getLevel ( textDocument, text );

      while ( stack.length && stack[stack.length - 1].level >= level ) stack.pop ();

      const insideMatch = stack.some ( parent => parent.matched ),
            matched = !insideMatch && todoRe.test ( text ) && Filter.isMatch ( text, terms );

      if ( matched ) stack.forEach ( parent => lines.add ( parent.lineNr ) );

      if ( matched || insideMatch ) lines.add ( lineNr );

      stack.push ({ lineNr, level, matched });

    }

    Filter.cache[textDocument.fileName] = { version: textDocument.version, query, lines };

    return lines;

  }

};

/* EXPORT */

export default Filter;
