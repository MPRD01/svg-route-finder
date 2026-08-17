document.addEventListener('DOMContentLoaded', () => {
    const fileUpload = document.getElementById('file-upload');
    const svgContainer = document.getElementById('svg-container');
    const statusTxt = document.getElementById('status');
    const debugCoords = document.getElementById('debug-coords');

    const resSlider = document.getElementById('res-slider');
    const resVal = document.getElementById('res-val');
    const tolSlider = document.getElementById('tol-slider');
    const tolVal = document.getElementById('tol-val');

    const algoSelect = document.getElementById('algo-select');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');

    let svgRoot = null;
    let graph = null;
    let pointAId = null;
    let pointBId = null;
    let inspectMode = false;
    let isGraphReady = false;

    resSlider.addEventListener('input', (e) => resVal.innerText = e.target.value);
    tolSlider.addEventListener('input', (e) => tolVal.innerText = e.target.value);

    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(ev.target.result, "image/svg+xml");

            svgContainer.innerHTML = '';
            svgRoot = doc.documentElement;

            if (!svgRoot.hasAttribute('viewBox')) {
                const w = svgRoot.getAttribute('width') || '1000';
                const h = svgRoot.getAttribute('height') || '1000';
                svgRoot.setAttribute('viewBox', `0 0 ${parseInt(w)} ${parseInt(h)}`);
            }
            svgRoot.style.width = '100%';
            svgRoot.style.height = '100%';

            svgContainer.appendChild(svgRoot);

            isGraphReady = false;
            pointAId = null;
            pointBId = null;
            statusTxt.innerText = "SVG loaded visually. Adjust Resolution & Tolerance, then click Generate Graph.";
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-extract').addEventListener('click', async () => {
        if (!svgRoot) {
            alert("Upload an SVG first!");
            return;
        }

        isGraphReady = false;
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        statusTxt.innerText = "Extracting raw geometry...";
        await new Promise(r => setTimeout(r, 50));

        const resolution = parseInt(resSlider.value, 10);
        const tolerance = parseInt(tolSlider.value, 10);

        graph = new NavigationGraph(tolerance);
        const segments = SVGExtractor.extractGeometry(svgRoot, resolution);

        await graph.buildFromSegmentsAsync(segments, (percent, msg) => {
            progressBar.style.width = percent + '%';
            statusTxt.innerText = msg;
        });

        createOverlayLayers();
        progressContainer.style.display = 'none';
        isGraphReady = true;
        statusTxt.innerText = `Graph generated! (${graph.nodes.size} nodes). Click map to select Start (A).`;
    });

    function createOverlayLayers() {
        let oldDebug = svgRoot.querySelector('#srf-debug-layer');
        if (oldDebug) oldDebug.remove();
        let oldRoute = svgRoot.querySelector('#srf-route-layer');
        if (oldRoute) oldRoute.remove();

        let debugLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        debugLayer.setAttribute("id", "srf-debug-layer");
        debugLayer.style.display = inspectMode ? "inline" : "none";

        let routeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        routeLayer.setAttribute("id", "srf-route-layer");

        svgRoot.appendChild(debugLayer);
        svgRoot.appendChild(routeLayer);
        drawDebugGraph();
    }

    svgContainer.addEventListener('mousemove', (e) => {
        if (!svgRoot) return;
        const pt = getSVGCoordinates(e.clientX, e.clientY);
        debugCoords.innerText = `Screen: ${e.clientX}, ${e.clientY} | SVG: ${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}`;
    });

    svgContainer.addEventListener('click', (e) => {
        if (!isGraphReady) return;
        const pt = getSVGCoordinates(e.clientX, e.clientY);

        if (!pointAId) {
            pointAId = graph.insertTemporaryNode(pt);
            if (pointAId) drawMarker(graph.nodes.get(pointAId), 'green', 'A');
            statusTxt.innerText = "Click to select Destination (Point B).";
        } else if (!pointBId) {
            pointBId = graph.insertTemporaryNode(pt);
            if (pointBId) {
                drawMarker(graph.nodes.get(pointBId), 'red', 'B');
                statusTxt.innerText = "Calculating Route...";
                setTimeout(calculateAndDrawRoute, 10);
            }
        }
    });

    function getSVGCoordinates(clientX, clientY) {
        const pt = svgRoot.createSVGPoint();
        pt.x = clientX; pt.y = clientY;
        return pt.matrixTransform(svgRoot.getScreenCTM().inverse());
    }

    function calculateAndDrawRoute() {
        const algo = algoSelect.value;
        const path = Pathfinder.findRoute(graph, pointAId, pointBId, algo);

        if (path) {
            drawRouteOverlay(path);
            statusTxt.innerText = `Route found using ${algo.toUpperCase()}!`;
        } else {
            statusTxt.innerText = "No route found. Geometry might be disconnected. Try increasing Merge Tolerance.";
        }
    }

    function drawRouteOverlay(nodes) {
        const layer = svgRoot.querySelector('#srf-route-layer');
        if (!layer) return;

        let d = `M ${nodes[0].x} ${nodes[0].y}`;
        for (let i = 1; i < nodes.length; i++) d += ` L ${nodes[i].x} ${nodes[i].y}`;

        const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.setAttribute("d", d);
        pathEl.setAttribute("class", "computed-route");
        layer.appendChild(pathEl);
    }

    function drawMarker(node, color, label) {
        const layer = svgRoot.querySelector('#srf-route-layer');
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", node.x); circle.setAttribute("cy", node.y);
        circle.setAttribute("r", 8); circle.setAttribute("fill", color);
        layer.appendChild(circle);
    }

    document.getElementById('btn-reset').addEventListener('click', () => {
        pointAId = null;
        pointBId = null;
        if (svgRoot && graph) {
            const routeLayer = svgRoot.querySelector('#srf-route-layer');
            if (routeLayer) routeLayer.innerHTML = '';
            graph.constructNodesAndEdges();
        }
        statusTxt.innerText = "Click map to select Start (A).";
    });

    document.getElementById('btn-inspect').addEventListener('click', () => {
        inspectMode = !inspectMode;
        if (svgRoot) {
            const debugLayer = svgRoot.querySelector('#srf-debug-layer');
            if (debugLayer) debugLayer.style.display = inspectMode ? "inline" : "none";
        }
    });

    function drawDebugGraph() {
        const layer = svgRoot.querySelector('#srf-debug-layer');
        if (!layer) return;
        layer.innerHTML = '';

        for (const seg of graph.segments) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", seg.p1.x); line.setAttribute("y1", seg.p1.y);
            line.setAttribute("x2", seg.p2.x); line.setAttribute("y2", seg.p2.y);
            line.setAttribute("class", "nav-debug-edge");
            layer.appendChild(line);
        }

        for (const node of graph.nodes.values()) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", node.x); circle.setAttribute("cy", node.y);
            circle.setAttribute("r", 3);
            circle.setAttribute("class", "nav-debug-node");
            layer.appendChild(circle);
        }
    }
});
