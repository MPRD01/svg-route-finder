const MathUtils = {
    distance(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y); },
    projectPointOnSegment(p, a, b) {
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const ap = { x: p.x - a.x, y: p.y - a.y };
        let lengthSq = ab.x * ab.x + ab.y * ab.y;
        if (lengthSq === 0) return { point: { x: a.x, y: a.y }, dist: this.distance(p, a), t: 0 };
        let t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / lengthSq));
        const snapped = { x: a.x + t * ab.x, y: a.y + t * ab.y };
        return { point: snapped, dist: this.distance(p, snapped), t: t };
    },
    getIntersection(a, b, c, d) {
        const denom = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
        if (Math.abs(denom) < 1e-6) return null;
        const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denom;
        const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denom;
        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return { x: a.x + ua * (b.x - a.x), y: a.y + ua * (b.y - a.y) };
        }
        return null;
    }
};
