// From https://github.com/pagestrip/reisy/blob/master/src/toposort.js
// And https://en.wikipedia.org/wiki/Topological_sorting#Depth-first_search

export default function toposort<K, T>(nodes: Array<T>, options: Options<K, T>): Result<T> {
  const sorter = new TopoSort(nodes, options);
  return sorter.sort();
}

enum Mark {
  None,
  Temporary,
  Permanent,
}

type Options<K, T> = {
  key: (node: T) => K;
  dependencies: (node: T) => Array<K>;
};

type Marked<T> = {
  mark: Mark;
  node: T;
};

type Result<T> = {
  sorted: Array<T>;
  errors: Array<Error>;
};

class TopoSort<K, T> {
  options: Options<K, T>;
  nodes: Map<K, Marked<T>> = new Map();
  result: Result<T> = { sorted: [], errors: [] };

  constructor(nodes: Array<T>, options: Options<K, T>) {
    this.options = options;

    for (const node of nodes) {
      const key = options.key(node);
      this.nodes.set(key, { mark: Mark.None, node });
    }
  }

  sort(): Result<T> {
    for (const [key, marked] of this.nodes) {
      if (marked.mark === Mark.None) {
        this.visit(key);
      }
    }
    return this.result;
  }

  private visit(key: K) {
    const { nodes, options, result } = this;
    const marked = nodes.get(key);
    if (!marked) {
      result.errors.push(new Error(`Unknown Node "${key}".`));
      return;
    }
    if (marked.mark === Mark.Temporary) {
      result.errors.push(new Error(`Node "${key}" is part of a cycle.`));
    }
    if (marked.mark !== Mark.None) {
      return;
    }

    marked.mark = Mark.Temporary;
    for (const dependency of options.dependencies(marked.node)) {
      this.visit(dependency);
    }
    marked.mark = Mark.Permanent;

    result.sorted.push(marked.node);
  }
}
