let SIM_DIM
let PANEL_DIM
let CANVAS_DIM;
const EPSILON = 1e-6;

const lerp = (a, b, t) => a * (1 - t) + b * t;

class SpeciesData {
    constructor({name, growth, oldage, shade, color, maxsize, offspring}) {
        // Species name
        this.name = name;

        // Growth per year
        this.growth = growth;

        // Chances of surviving an year in the shadow
        this.shade = shade;

        // Max size
        this.maxsize = maxsize;

        // Probability of surviving an year after reaching max size
        this.oldage = oldage;

        // Probability of producing offspring this year
        this.offspring = offspring;

        // Color to debug
        this.color = color;
        this.color.setAlpha(200);
    }
}

class Tree {
    constructor({species, pos}) {
        this.species = species;
        this.radius = 1;
        this.pos = pos;
        this.dominated = false;
    }
    
    display() {
        fill(species[this.species].color);
        circle(this.pos.x, this.pos.y, this.radius * 2);
    }

    grow() {
        this.radius += species[this.species].growth;
    }

    intersects(other) {
        let dst = p5.Vector.sub(this.pos, other.pos).magSq();
        let linemgn = (this.radius + other.radius) * (this.radius + other.radius);

        if (dst - linemgn < EPSILON) {
            return true;
        }
        return false;
    }

    getRandomPointAroundSpawn() {
        let dst = lerp(this.radius * 3, this.radius * 4, random(1));
        let randomPoint = () => p5.Vector.add(this.pos, p5.Vector.mult(p5.Vector.random2D(), dst));
        let point = randomPoint();
        while (!isWithinCanvasBounds(point.x, point.y)) {
            point = randomPoint();
        }
        return point;
    }

    get oldage() {
        return this.radius >= species[this.species].maxsize;
    }

    get x() {
        return this.pos.x;
    }

    get y() {
        return this.pos.y;
    }
}

class Simulator {
    static TREE_COUNT = 50;

    constructor() {
        this.qt = new Quadtree({
            x: 0, y: 0, width: SIM_DIM.x, height: SIM_DIM.y
        });;
        this.trees = new Set();
        this.reset();
    }

    reset() {
        this.qt.clear()
        this.createTrees();
    }

    step() {
        for (const tree of this.trees) {
            this.resolveDominance(tree);
        }

        let newQt = new Quadtree(this.qt.bounds);
        let newTrees = new Set();
        for (let t of this.trees) {
            let shaded = random(1) < species[t.species].shade;
            let survive = random(1) < species[t.species].oldage;
            let offspring = random(1) < species[t.species].offspring;

            if (t.dominated && shaded) {
                // Production 1
                newQt.insert(t);
            } else if (t.dominated) {
                // Produciton 2
                this.trees.delete(t);
            } else if (t.oldage && survive) {
                // Production 3
                newQt.insert(t);
            } else if (t.oldage) {
                // Production 4
                this.trees.delete(t);
            } else {
                // Production 5: grow and spawn
                t.grow();
                newQt.insert(t);
                if (offspring) {
                    let tree = new Tree({
                        species: t.species,
                        pos: t.getRandomPointAroundSpawn()
                    })
                    newTrees.add(tree);
                    newQt.insert(tree);
                }
            }
        }
        this.qt = newQt;
        this.trees = this.trees.union(newTrees);
    }

    createTrees() {
        this.trees = new Set();
        for (let i = 0; i < Simulator.TREE_COUNT; i++) {
            let tree = new Tree({
                species: random(Object.keys(species)),
                pos: createVector(random(SIM_DIM.x), random(SIM_DIM.y))
            })
            this.trees.add(tree);
            this.qt.insert(tree);
        }
    }

    display() {
        for (const tree of this.trees) {
            tree.display();
        }
    }

    resolveDominance(t1) {
        for (const t2 of this.qt.retrieve(t1)) {
            if (t1 != t2 && t1.intersects(t2)) {
                if (t1.radius < t2.radius) {
                    t1.dominated = true;
                } else {
                    t2.dominated = true;
                }
            }
        }
    }
}

function createSpecies() {
    species = {
        elm: new SpeciesData({
            name: 'elm', growth: 0.2, oldage: 0.96, shade: 0.7,
            color: color('green'), maxsize: 7, offspring: 0.4
        }),
        palm: new SpeciesData({
            name: 'palm', growth: 0.6, oldage: 0.8, shade: 0.4,
            color: color('orange'), maxsize: 7, offspring: 0.5
        }),
        bush: new SpeciesData({
            name: 'bush', growth: 0.75, oldage: 0.4, shade: 0.8,
            color: color('red'), maxsize: 3, offspring: 0.8
        })
    };
}

function isWithinCanvasBounds(x, y) {
    return x >= 0 && x <= SIM_DIM.x && y >= 0 && y <= SIM_DIM.y;
}

const timeBetweenSteps = 0.01;  // seconds
let species = {};
let simulator;
let timeSinceLastStep = 0;  // seconds
let playing = false;

function setup() {
    SIM_DIM = createVector(800, 800);
    PANEL_DIM = createVector(200, 0);
    CANVAS_DIM = p5.Vector.add(SIM_DIM, PANEL_DIM)

    createCanvas(CANVAS_DIM.x, CANVAS_DIM.y);
    createSpecies();

    simulator = new Simulator();

    // Step button
    button = createButton("Step");
    button.size(50, 30);
    button.position(CANVAS_DIM.x - 60, CANVAS_DIM.y - 40);
    button.mousePressed(onStepPressed);

    // Play/Stop button
    playButton = createButton("P");
    playButton.size(30, 30);
    playButton.position(CANVAS_DIM.x - 100, CANVAS_DIM.y - 40);
    playButton.mousePressed(onPlayPressed);

    // Reset button
    resetButton = createButton("R");
    resetButton.size(30, 30);
    resetButton.position(CANVAS_DIM.x - 140, CANVAS_DIM.y - 40);
    resetButton.mousePressed(onResetPressed);
}

function onStepPressed() {
    simulator.step();
}

function onPlayPressed() {
    playing = !playing;
}

function onResetPressed() {
    simulator.reset();
}

function draw() {
    frameRate(60);
    background(220);
    noStroke();
    simulator.display();

    if (playing) {
        timeSinceLastStep += (deltaTime / 1000);
        if (timeBetweenSteps - timeSinceLastStep < EPSILON) {
            simulator.step();
            timeSinceLastStep = 0;
        }
    }
}
