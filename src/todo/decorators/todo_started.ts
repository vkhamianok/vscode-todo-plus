
/* IMPORT */

import * as vscode from 'vscode';
import DecorationTypes from './decoration_types';
import Consts from '../../consts';
import TodoBoxItem from '../items/todo_box';
import Line from './line';

/* DECORATION TYPES */

const TODO_STARTED = DecorationTypes.lazy ( () => vscode.window.createTextEditorDecorationType ({
  color: Consts.colors.started,
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
  dark: {
    color: Consts.colors.dark.started
  },
  light: {
    color: Consts.colors.light.started
  }
}) );

/* TODO STARTED */

class TodoStarted extends Line {

  TYPES = [TODO_STARTED ()];

  getItemRanges ( todoStarted: TodoBoxItem, negRange?: vscode.Range | vscode.Range[] ) {

    return [this.getRangeDifference ( todoStarted.text, todoStarted.range, negRange || [Consts.regexes.tag, Consts.regexes.formattedCode] )];

  }

}

/* EXPORT */

export default TodoStarted;
