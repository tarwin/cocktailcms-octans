type NodeId = string;
type EdgeWeight = number;
type EncodedEdge = string;

interface Serialized {
  nodes: { id: NodeId }[];
  links: { source: NodeId; target: NodeId; weight: EdgeWeight }[];
}

// A graph data structure with depth-first search and topological sort.
export default class Graph {

    // The adjacency list of the graph.
    // Keys are node ids.
    // Values are adjacent node id arrays.
    public edges: Record<NodeId, NodeId[]> = {}

    // The weights of edges.
    // Keys are string encodings of edges.
    // Values are weights (numbers).
    public edgeWeights: Record<EncodedEdge, EdgeWeight> = {}

    constructor(serialized?: Serialized) {
      // If a serialized graph was passed into the constructor, deserialize it.
      if (serialized) {
        this.deserialize(serialized)
      }
    }

    // Adds a node to the graph.
    // If node was already added, this function does nothing.
    // If node was not already added, this function sets up an empty adjacency list.
    public addNode(node: NodeId) {
      this.edges[node] = this.adjacent(node)
      return this
    }

    // Removes a node from the graph.
    // Also removes incoming and outgoing edges.
    public removeNode(node: NodeId) {
      // Remove incoming edges.
      Object.keys(this.edges).forEach((u) => {
        this.edges[u].forEach((v) => {
            if (v === node) {
              this.removeEdge(u, v)
            }
          })
      })

      // Remove outgoing edges (and signal that the node no longer exists).
      delete this.edges[node]

      return this
    }

    // Gets the list of nodes that have been added to the graph.
    public nodes(): NodeId[] {
      // TODO: Better implementation with set data structure
      const nodeSet: Record<NodeId, boolean> = {}

      Object.keys(this.edges).forEach((u) => {
        nodeSet[u] = true
        this.edges[u].forEach((v) => {
          nodeSet[v] = true
        })
      })
      return Object.keys(nodeSet)
    }

    // Gets the adjacent node list for the given node.
    // Returns an empty array for unknown nodes.
    public adjacent(node: NodeId): NodeId[] {
      return this.edges[node] || []
    }

    // Sets the weight of the given edge.
    public setEdgeWeight(u: NodeId, v: NodeId, weight: EdgeWeight) {
      this.edgeWeights[this.encodeEdge(u, v)] = weight
      return this
    }

    // Gets the weight of the given edge.
    // Returns 1 if no weight was previously set.
    public getEdgeWeight(u: NodeId, v: NodeId): EdgeWeight {
      const weight = this.edgeWeights[this.encodeEdge(u, v)]
      return weight === undefined ? 1 : weight
    }

    // Adds an edge from node u to node v.
    // Implicitly adds the nodes if they were not already added.
    public addEdge(u: NodeId, v: NodeId, weight?: EdgeWeight) {
      this.addNode(u)
      this.addNode(v)
      this.adjacent(u).push(v)

      if (weight !== undefined) {
        this.setEdgeWeight(u, v, weight)
      }

      return this
    }

    // Removes the edge from node u to node v.
    // Does not remove the nodes.
    // Does nothing if the edge does not exist.
    public removeEdge(u: NodeId, v: NodeId) {
      if (this.edges[u]) {
        this.edges[u] = this.adjacent(u).filter((vv) => {
          return vv !== v
        })
      }
      return this
    }

    // Computes the indegree for the given node.
    // Not very efficient, costs O(E) where E = number of edges.
    public indegree(node: NodeId) {
      let degree = 0
      Object.keys(this.edges).forEach((u) => {
        this.edges[u].forEach((v: NodeId) => {
          if (v === node) {
            degree++
          }
        })
      });
      return degree
    }

    // Computes the outdegree for the given node.
    public outdegree(node: NodeId) {
      return node in this.edges ? this.edges[node].length : 0
    }

    // Depth First Search algorithm, inspired by
    // Cormen et al. "Introduction to Algorithms" 3rd Ed. p. 604
    // The additional option `includeSourceNodes` specifies whether to
    // include or exclude the source nodes from the result (true by default).
    // If `sourceNodes` is not specified, all nodes in the graph
    // are used as source nodes.
    public depthFirstSearch(
      sourceNodes?: NodeId[],
      includeSourceNodes: boolean = true
    ) {
      if (!sourceNodes) {
        sourceNodes = this.nodes()
      }

      if (typeof includeSourceNodes !== 'boolean') {
        includeSourceNodes = true
      }

      const visited: Record<NodeId, boolean> = {}
      const nodeList: NodeId[] = []

      const dfsVisit = (node: NodeId) => {
        if (!visited[node]) {
          visited[node] = true
          this.adjacent(node).forEach(dfsVisit)
          nodeList.push(node)
        }
      }

      if (includeSourceNodes) {
        sourceNodes.forEach(dfsVisit)
      } else {
        sourceNodes.forEach((node) => {
          visited[node] = true
        })
        sourceNodes.forEach((node) => {
          this.adjacent(node).forEach(dfsVisit)
        })
      }

      return nodeList
    }

    // Least Common Ancestors
    // Inspired by https://github.com/relaxedws/lca/blob/master/src/LowestCommonAncestor.php code
    // but uses depth search instead of breadth. Also uses some optimizations
    public lowestCommonAncestors(node1: NodeId, node2: NodeId) {
      const node1Ancestors: NodeId[] = []
      const lcas: NodeId[] = []

      const ca1Visit = (visited: Record<NodeId, boolean>, node: NodeId): boolean => {
        if (!visited[node]) {
          visited[node] = true
          node1Ancestors.push(node)
          if (node === node2) {
            lcas.push(node)
            // found - shortcut
            return false
          }
          return this.adjacent(node).every(nodeInner => {
            return ca1Visit(visited, nodeInner)
          })
        } else {
          return true
        }
      }

      const ca2Visit = (visited: Record<NodeId, boolean>, node: NodeId) => {
        if (!visited[node]) {
          visited[node] = true
          if (node1Ancestors.indexOf(node) >= 0) {
            lcas.push(node)
          } else if (lcas.length === 0) {
            this.adjacent(node).forEach(nodeInner => {
              ca2Visit(visited, nodeInner)
            });
          }
        }
      }

      if (ca1Visit({}, node1)) {
          // No shortcut worked
          ca2Visit({}, node2);
      }

      return lcas;
    }

    // The topological sort algorithm yields a list of visited nodes
    // such that for each visited edge (u, v), u comes before v in the list.
    // Amazingly, this comes from just reversing the result from depth first search.
    // Cormen et al. "Introduction to Algorithms" 3rd Ed. p. 613
    public topologicalSort(
      sourceNodes: NodeId[],
      includeSourceNodes: boolean = true
    ) {
      return this.depthFirstSearch(sourceNodes, includeSourceNodes).reverse()
    }

    // Dijkstra's Shortest Path Algorithm.
    // Cormen et al. "Introduction to Algorithms" 3rd Ed. p. 658
    // Variable and function names correspond to names in the book.
    public shortestPath(source: NodeId, destination: NodeId) {
      // Upper bounds for shortest path weights from source.
      const d: Record<NodeId, EdgeWeight> = {}

      // Predecessors.
      const p: Record<NodeId, NodeId> = {}

      // Poor man's priority queue, keyed on d.
      let q: Record<NodeId, boolean> = {};

      const initializeSingleSource = () => {
        this.nodes().forEach(function(node) {
          d[node] = Infinity
        })
        if (d[source] !== Infinity) {
          throw new Error('Source node is not in the graph');
        }
        if (d[destination] !== Infinity) {
          throw new Error('Destination node is not in the graph');
        }
        d[source] = 0
      }

      // Adds entries in q for all nodes.
      const initializePriorityQueue = () => {
        this.nodes().forEach(function(node) {
          q[node] = true
        })
      }

      // Returns true if q is empty.
      const priorityQueueEmpty = () => {
        return Object.keys(q).length === 0
      }

      // Linear search to extract (find and remove) min from q.
      const extractMin = (): NodeId | null => {
        let min = Infinity
        let minNode: NodeId | undefined
        Object.keys(q).forEach((node) => {
          if (d[node] < min) {
            min = d[node]
            minNode = node
          }
        })
        if (minNode === undefined) {
          // If we reach here, there's a disconnected subgraph, and we're done.
          q = {};
          return null
        }
        delete q[minNode]
        return minNode
      }

      const relax = (u: NodeId, v: NodeId) => {
        const w = this.getEdgeWeight(u, v)
        if (d[v] > d[u] + w) {
          d[v] = d[u] + w
          p[v] = u
        }
      }

      const dijkstra = () => {
        initializeSingleSource()
        initializePriorityQueue()
        while (!priorityQueueEmpty()) {
          const u = extractMin();
          if (u === null) return;
          this.adjacent(u).forEach((v) => {
            relax(u as string, v)
          })
        }
      }

      // Assembles the shortest path by traversing the
      // predecessor subgraph from destination to source.
      const path = () => {
        const nodeList: NodeId[] & { weight?: EdgeWeight } = []
        let weight = 0
        let node = destination
        while (p[node]) {
          nodeList.push(node)
          weight += this.getEdgeWeight(p[node], node)
          node = p[node]
        }
        if (node !== source) {
          throw new Error(`No path found: ${source} => ${destination}`)
        }
        nodeList.push(node)
        nodeList.reverse()
        nodeList.weight = weight
        return nodeList
      }

      dijkstra()

      return path()
    }

    // Serializes the graph.
    public serialize(): Serialized {
      const serialized: Serialized = {
        nodes: this.nodes().map(function(id) {
          return { id }
        }),
        links: []
      }

      serialized.nodes.forEach((node) => {
        const source = node.id;
        this.adjacent(source).forEach((target) => {
          serialized.links.push({
            source,
            target,
            weight: this.getEdgeWeight(source, target)
          })
        })
      })

      return serialized
    }

    // Deserializes the given serialized graph.
    public deserialize(serialized: Serialized) {
      serialized.nodes.forEach((node) => {
        this.addNode(node.id)
      })
      serialized.links.forEach((link) => {
        this.addEdge(link.source, link.target, link.weight)
      });
      return this
    }

    public splitIntoConnectedGraphs() {
      const splitGraphsKeys:Array<Array<string>> = []
      for (const keyA of Object.keys(this.edges)) {
        for (const keyB of Object.keys(this.edges)) {
          if (keyA === keyB) continue
          let connected
          try {
            connected = this.shortestPath(keyA, keyB)
          } catch (e) { /* */ }
          const existsA = splitGraphsKeys.find(a => a.includes(keyA) ? a : false)
          const existsB = splitGraphsKeys.find(a => a.includes(keyB) ? a : false)
          if (connected) {
            if (existsA && !existsB) {
              existsA.push(keyB)
            } else if (!existsA && existsB) {
              existsB.push(keyA)
            } else if (!existsA && !existsB) {
              splitGraphsKeys.push([keyA, keyB])
            }
            // both exists ...
          } else {
            if (!existsA) {
              splitGraphsKeys.push([keyA])
            }
          }
        }
      }
      
      const graphs:Array<Graph> = []
      for (const splitGraphKeys of splitGraphsKeys) {
        const newGraph = new Graph()
        for (const k of Object.keys(this.edges)) {
          if (splitGraphKeys.includes(k)) {
            newGraph.edges[k] = ([] as Array<string>).concat(this.edges[k])
          }
        }
        graphs.push(newGraph)
      }
      return graphs
    }

    public isCyclic(): boolean {
      const visited: Record<NodeId, boolean> = {}
      const recStack: Record<NodeId, boolean> = {}
  
      for (const node of Object.keys(this.edges)) {
        if (this.detectCyclic(node, visited, recStack)) return true
      }
      return false
    }

    public copy() {
      return new Graph(this.serialize())
    }

    public makeUndirected() {
      for (const edgeKey of Object.keys(this.edges)) {
        for (const adjacentKey of this.edges[edgeKey]) {
          if (!this.edges[adjacentKey].includes(edgeKey)) {
            this.addEdge(adjacentKey, edgeKey, this.getEdgeWeight(adjacentKey, edgeKey))
          }
        }
      }
      return this
    }

    public trimTo(wantedNodes:Array<NodeId>) {
      const undirected = this.copy().makeUndirected()
      let needed:NodeId[] = []
      if (wantedNodes.length > 1) {
        // get paths between all nodes
        for (const [key1, key2] of this.pairwise(wantedNodes)) {
          needed = needed.concat(undirected.shortestPath(key1, key2))
        }
        needed = [...new Set(needed)]
      } else {
        needed = wantedNodes
      }
      const uneededKeys = Object.keys(this.edges).filter(key => !needed.includes(key))
      uneededKeys.forEach((k) => this.removeNode(k))
      return this
    }

    public getLongestPath() {
      const paths:Array<NodeId[]> = []
      for (const [key1, key2] of this.pairwise(Object.keys(this.edges))) {
        try {
          paths.push(this.shortestPath(key1, key2))
        } catch (e) { /* */ }
      }
      let longest:NodeId[] | null = null
      for (const path of paths) {
        if (!longest) {
          longest = path
          continue
        }
        if (path.length > longest.length) {
          longest = path
        }
      }
      return longest
    }

    // Computes a string encoding of an edge,
    // for use as a key in an object.
    private encodeEdge(u: NodeId, v: NodeId): EncodedEdge {
      return u + '|' + v
    }
  
    private detectCyclic(vertex: NodeId, visited: Record<NodeId, boolean>, recStack: Record<NodeId, boolean>): boolean {
      if (!visited[vertex]) {
        visited[vertex] = true
        recStack[vertex] = true
        for (const currentNode of this.edges[vertex]) {
          if (
            !visited[currentNode] && this.detectCyclic(currentNode, visited, recStack) ||
            recStack[currentNode]
          ) {
            return true
          }
        }
      }
      recStack[vertex] = false
      return false
    }

    private pairwise(list:Array<string>): Array<[string, string]> {
      if (list.length < 2) { return []; }
      const first = list[0]
      const rest  = list.slice(1)
      const pairs: Array<[string, string]> = rest.map((x) => [first, x] as [string, string])
      return pairs.concat(this.pairwise(rest))
    }
}
