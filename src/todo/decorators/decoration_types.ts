
/* IMPORT */

import * as _ from 'lodash';
import * as vscode from 'vscode';

/* DECORATION TYPES */

// Decoration types are built from the config, so they are created lazily and recreated after it changes

const DecorationTypes = {

  generation: 0,
  types: [] as vscode.TextEditorDecorationType[],

  lazy<T> ( factory: () => T ): () => T {

    let value: T,
        generation = -1;

    return () => {

      if ( generation !== DecorationTypes.generation ) {

        value = factory ();
        generation = DecorationTypes.generation;

        DecorationTypes.types.push ( ..._.castArray ( value as any ) );

      }

      return value;

    };

  },

  reset () {

    DecorationTypes.types.forEach ( type => type.dispose () ); // Also removes their decorations from every editor

    DecorationTypes.types = [];
    DecorationTypes.generation++;

  }

};

/* EXPORT */

export default DecorationTypes;
