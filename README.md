# SVG Route Finder

A browser-based, geometry-aware pathfinding engine that works directly with raw SVG vector data. 

Most browser pathfinding solutions take the easy way out: they rasterize the map into a grid of pixels and run standard grid-based A*. This project takes a harder, more precise route. It parses the SVG DOM, respects nested transformation matrices, constructs a navigable topological graph directly from the vector geometry, and calculates routes using mathematical intersections.

## How It Works (The Architecture)

Turning a visual illustration into a navigable graph requires solving several computational geometry problems. Here is how we tackled them:

### 1. Taming SVG Coordinates (CTM Inversion)
**The Problem:** SVGs have notoriously tricky coordinate systems. A map might be scaled, translated, or placed inside deeply nested `<g>` tags. 
**The Solution:** We grab the root Current Transformation Matrix (CTM), invert it, and multiply it against the local CTM of every path. This effectively "flattens" the entire map. It guarantees that wherever your mouse clicks on the screen, it translates perfectly to the raw mathematical space of the SVG, completely ignoring visual scaling.

### 2. Curve Sampling & Discretization
**The Problem:** Standard pathfinding algorithms require distinct nodes and straight edges, but SVGs contain bezier curves and arcs (`<path d="M... C... Q...">`).
**The Solution:** We implemented a dynamic curve sampler. By reading the `getTotalLength()` of a path and stepping through it using `getPointAtLength()`, the engine discretizes curves into a series of straight line segments based on a user-defined "Resolution" slider. We also subdivide long straight lines so that intersecting roads have plenty of vertices to latch onto.

### 3. The $O(N^2)$ Intersection Problem (Spatial Grid Indexing)
**The Problem:** To make a map navigable, every line that visually crosses another line needs to be split at the intersection point to share a graph node. If a city map (like Berlin) has 50,000 road segments, checking every segment against every other segment requires 1.25 billion math operations. This immediately crashes the browser.
**The Solution:** We implemented a **Uniform Spatial Grid Index**. Before checking for intersections, the engine calculates the bounding box of the entire map and chops it into a grid. Each road is dropped into its respective grid cells. When a road looks for intersections, it *only* checks the roads inside its own cell. This drops the workload from billions of checks to just a few thousand.

### 4. Fixing the "Overpass Effect" (Merge Tolerance)
**The Problem:** Often, two roads in an SVG look like they connect, but mathematically, one ends 0.5 pixels away from the other. The algorithm treats this like a highway overpass—they cross, but you can't drive from one to the other, resulting in wildly incorrect, convoluted routes.
**The Solution:** We built a **Point-to-Segment Projection** technique. We added a "Merge Tolerance" threshold. The engine actively looks at the endpoints of every line and projects them perpendicularly onto nearby lines. If the endpoint is within the pixel tolerance, the engine mathematically "welds" them together, forcing them to share a node.

### 5. Keeping the Browser Alive (Async Chunking)
**The Problem:** JavaScript is single-threaded. Even with a spatial grid, processing a massive city map blocks the main UI thread, causing the browser to freeze and display an "Unresponsive Page" warning.
**The Solution:** The graph generation is heavily asynchronous. We chunk the intersection math into small batches. After processing 50 segments, the engine uses `setTimeout(..., 0)` to pause for exactly 1 millisecond. This yields control back to the browser so it can update the progress bar and keep the UI responsive, before picking up the next batch of math.

### 6. Pathfinding Algorithms
Once the geometric graph is built, we use a Priority Queue to run the actual routing:
*   **A* (A-Star):** Uses a heuristic (Euclidean distance to the goal) to aggressively search toward the destination. It is incredibly fast and great for most maps.
*   **Dijkstra:** Ignores the heuristic and searches equally in all directions. It takes slightly longer but guarantees the absolute mathematically shortest path across highly complex, overlapping geometries.

## Usage & Installation

Because this engine is built entirely in vanilla HTML, CSS, and JavaScript with zero dependencies, there is no build step required.

1. Clone this repository -
   Clone the repository:

```bash
git clone <repository-url>
cd svg-route-finder
```

Start a local server:

```bash
python -m http.server
```

Then open:

```text
http://localhost:8000
```

Upload an SVG
