
/* IMPORT */

import * as vscode from 'vscode';
import DecorationTypes from './decoration_types';
import Config from '../../config';
import Consts from '../../consts';
import FormattedItem from '../items/formatted';
import Line from './line';

/* DECORATION TYPES */

const CODE = DecorationTypes.lazy ( () => vscode.window.createTextEditorDecorationType ({
  color: Consts.colors.code,
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  dark: {
    color: Consts.colors.dark.code
  },
  light: {
    color: Consts.colors.light.code
  }
}) );

const BOLD = DecorationTypes.lazy ( () => vscode.window.createTextEditorDecorationType ({
  fontWeight: 'bold',
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}) );

const ITALIC = DecorationTypes.lazy ( () => vscode.window.createTextEditorDecorationType ({
  fontStyle: 'oblique',
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}) );

const STRIKETHROUGH = DecorationTypes.lazy ( () => vscode.window.createTextEditorDecorationType ({
  textDecoration: 'line-through',
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}) );

/* FORMATTED */

class Formatted extends Line {

  TYPES = [CODE (), BOLD (), ITALIC (), STRIKETHROUGH ()];

  getItemRanges ( formatted: FormattedItem ) {

    return this.TYPES.map ( ( type, index ) => formatted.match[index + 1] && [formatted.range] );

  }

}

/* EXPORT */

export default Formatted;
