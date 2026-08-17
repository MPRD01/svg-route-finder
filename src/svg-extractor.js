const SVGExtractor = {
    transformPoint(svgPoint, matrix) { return svgPoint.matrixTransform(matrix); },

    subdivideSegment(p1, p2, resolution) {
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (dist <= resolution) return [{ p1, p2 }];

        const segments = [];
        const numSamples = Math.ceil(dist / resolution);
        let prev = p1;

        for (let i = 1; i <= numSamples; i++) {
            const t = i / numSamples;
            const current = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t
            };
            segments.push({ p1: prev, p2: current });
            prev = current;
        }
        return segments;
    },

    extractGeometry(svgRoot, sampleResolution = 30) {
        const svgPoint = svgRoot.createSVGPoint();
        const segments = [];

        let container = svgRoot.querySelector('#routes') || svgRoot.querySelector('#route-network') || svgRoot;
        if (container !== svgRoot) container.style.opacity = '0';

        const elements = container.querySelectorAll('line, polyline, polygon, path');
        const rootScreenCTM = svgRoot.getScreenCTM();
        if (!rootScreenCTM) return [];
        const invRootCTM = rootScreenCTM.inverse();

        const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svgRoot.appendChild(tempPath);

        elements.forEach(el => {
            const elScreenCTM = el.getScreenCTM();
            if (!elScreenCTM) return;
            const ctm = invRootCTM.multiply(elScreenCTM);
            const type = el.tagName.toLowerCase();

            if (type === 'line') {
                svgPoint.x = el.x1.baseVal.value; svgPoint.y = el.y1.baseVal.value;
                const p1 = this.transformPoint(svgPoint, ctm);
                svgPoint.x = el.x2.baseVal.value; svgPoint.y = el.y2.baseVal.value;
                const p2 = this.transformPoint(svgPoint, ctm);
                this.subdivideSegment(p1, p2, sampleResolution).forEach(s => segments.push({...s, ref: el}));
            }
            else if (type === 'polyline' || type === 'polygon') {
                const points = el.points;
                for (let i = 0; i < points.length - 1; i++) {
                    svgPoint.x = points[i].x; svgPoint.y = points[i].y;
                    const p1 = this.transformPoint(svgPoint, ctm);
                    svgPoint.x = points[i+1].x; svgPoint.y = points[i+1].y;
                    const p2 = this.transformPoint(svgPoint, ctm);
                    this.subdivideSegment(p1, p2, sampleResolution).forEach(s => segments.push({...s, ref: el}));
                }
                if (type === 'polygon' && points.length > 0) {
                    svgPoint.x = points[points.length-1].x; svgPoint.y = points[points.length-1].y;
                    const p1 = this.transformPoint(svgPoint, ctm);
                    svgPoint.x = points[0].x; svgPoint.y = points[0].y;
                    const p2 = this.transformPoint(svgPoint, ctm);
                    this.subdivideSegment(p1, p2, sampleResolution).forEach(s => segments.push({...s, ref: el}));
                }
            }
            else if (type === 'path') {
                const d = el.getAttribute('d');
                if (!d) return;

                const subpaths = d.split(/(?=[Mm])/).map(s => s.trim()).filter(s => s.length > 0);

                for (const subD of subpaths) {
                    tempPath.setAttribute('d', subD);
                    const length = tempPath.getTotalLength();
                    if (length === 0) continue;

                    let numSamples = Math.max(2, Math.ceil(length / sampleResolution));
                    let prevPoint = null;

                    for (let i = 0; i <= numSamples; i++) {
                        const dist = (i / numSamples) * length;
                        const pt = tempPath.getPointAtLength(dist);
                        svgPoint.x = pt.x; svgPoint.y = pt.y;
                        const tp = this.transformPoint(svgPoint, ctm);
                        const currentPoint = {x: tp.x, y: tp.y};

                        if (prevPoint) segments.push({ p1: prevPoint, p2: currentPoint, ref: el });
                        prevPoint = currentPoint;
                    }
                }
            }
        });

        tempPath.remove();
        return segments;
    }
};
