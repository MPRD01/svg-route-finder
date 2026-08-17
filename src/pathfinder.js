class PriorityQueue {
    constructor() { this.items = []; }
    enqueue(element, priority) {
        const qElement = { element, priority };
        let added = false;
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].priority > qElement.priority) {
                this.items.splice(i, 0, qElement);
                added = true; break;
            }
        }
        if (!added) this.items.push(qElement);
    }
    dequeue() { return this.items.shift(); }
    isEmpty() { return this.items.length === 0; }
}

const Pathfinder = {
    findRoute(graph, startId, goalId, algorithm = "astar") {
        const openSet = new PriorityQueue();
        const cameFrom = new Map();
        const gScore = new Map();

        for (let key of graph.nodes.keys()) gScore.set(key, Infinity);

        gScore.set(startId, 0);
        openSet.enqueue(startId, 0);

        const goalNode = graph.nodes.get(goalId);

        while (!openSet.isEmpty()) {
            const currentId = openSet.dequeue().element;

            if (currentId === goalId) {
                return this.reconstructPath(cameFrom, currentId, graph);
            }

            const currentNode = graph.nodes.get(currentId);

            for (let edge of currentNode.edges) {
                const neighborId = edge.to;
                const tentativeGScore = gScore.get(currentId) + edge.weight;

                if (tentativeGScore < gScore.get(neighborId)) {
                    cameFrom.set(neighborId, currentId);
                    gScore.set(neighborId, tentativeGScore);

                    let fScore = tentativeGScore;

                    if (algorithm === "astar") {
                        const neighborNode = graph.nodes.get(neighborId);
                        fScore += MathUtils.distance(neighborNode, goalNode);
                    }

                    openSet.enqueue(neighborId, fScore);
                }
            }
        }
        return null;
    },

    reconstructPath(cameFrom, currentId, graph) {
        const totalPath = [graph.nodes.get(currentId)];
        while (cameFrom.has(currentId)) {
            currentId = cameFrom.get(currentId);
            totalPath.unshift(graph.nodes.get(currentId));
        }
        return totalPath;
    }
};
