const socket = io("http://localhost:5000")

const createLobbyBtn = document.getElementById("create-btn")
const joinLobbyBtn = document.getElementById("join-btn")
const lobbyInput = document.getElementById("lobby-num")
const statusText = document.getElementById("lobby-status")

const SPEED = 5
const TILE = 16      // A sprite is one 16x16 tile on the sheet
const DRAW_SIZE = 32 // ...drawn at double size

// Which pair of frames on the sheet belongs to which direction
const WALK_FRAMES = {
    right: [0, 1],
    left: [2, 3],
    up: [4, 5],
    down: [6, 7]
}

let clientUniqueId = null // The lobby this client is in, host or joiner
let players = []          // Every sprite in the lobby, this client's included
let spritesheet = null

function say(message) {
    console.log(message)
    if (statusText) { statusText.textContent = message }
}

function createLobby() {
    socket.emit("create-lobby")
}

// Asking server for a lobby

function joinLobby() {
    const code = lobbyInput.value.trim()
    if (!code) { return }
    socket.emit("join-lobby", { roomUniqueId: code })
    // The lobby id is only adopted once the server confirms the lobby
    // exists, so a typo doesn't leave this client emitting into nowhere
}

if (createLobbyBtn) { createLobbyBtn.addEventListener("click", createLobby) }
if (joinLobbyBtn) { joinLobbyBtn.addEventListener("click", joinLobby) }

socket.on("connect", () => {
    say("Your id: " + socket.id)
    player.id = socket.id
})

// Prints a message when the client connects
// Synchronising the player id to be the socket id everytime a connection occurs

socket.on("new-lobby", (data) => {
    clientUniqueId = data.roomUniqueId // client lobby host's id is the lobby's id we got from the server
    say("Waiting for a player to join, lobby code " + clientUniqueId)
})

socket.on("lobby-joined", (data) => {
    clientUniqueId = data.roomUniqueId
    say("Joined lobby " + clientUniqueId)
})

socket.on("lobby-error", (data) => say(data.message))

socket.on("players-connected", (data) => {
    // The server sends the whole roster, not just the newcomer, so a
    // joiner spawns everyone already in the lobby and not only the other
    // way round
    syncRoster(data.players)
})
// Spawning a new player when a player connects

socket.on("player-left", (data) => {
    players = players.filter((p) => p.id !== data.id)
})
// Despawning a player when they disconnect

socket.on("friend-moved", (data) => {
    // The moving friend's coordinates are updated
    for (let p = 0; p < players.length; p++) {
        if (players[p].id === data.id) {
            players[p].x = data.x
            players[p].y = data.y
            players[p].frame = data.frame
        }
    }
})

function syncRoster(ids) {
    if (!ids) { return }

    for (const id of ids) {
        if (id === socket.id) { continue }
        // Don't spawn a second sprite for ourselves
        if (players.some((p) => p.id === id)) { continue }
        // ...or a duplicate of somebody already on screen
        players.push(new Sprite(10, 10, 3, id))
    }

    players = players.filter((p) => p.id === socket.id || ids.includes(p.id))
}

class Sprite {
    constructor(x, y, ghost, id) {
        this.x = x
        this.y = y
        this.ghost = ghost
        this.id = id

        this.vel_x = 0
        this.vel_y = 0
        this.frame = 0

        this.dir = "down"
        this.step = 0

        this.lastSent = null
    }

    get isLocal() {
        return this.id === socket.id
    }

    move(dir) {
        this.dir = dir
        this.vel_x = dir === "left" ? -SPEED : dir === "right" ? SPEED : 0
        this.vel_y = dir === "up" ? -SPEED : dir === "down" ? SPEED : 0
        /* Only one axis is ever set, so there's no diagonal movement */
    }

    stop(dir) {
        if (this.dir !== dir) { return }
        // A keyup for a direction we already turned away from shouldn't
        // stop the direction we're currently walking in
        this.vel_x = 0
        this.vel_y = 0
        this.frame = WALK_FRAMES[this.dir][0]
    }

    animate() { // Call this in the draw() function
        if (this.isLocal) {
            this.x += this.vel_x
            this.y += this.vel_y

            if (this.vel_x !== 0 || this.vel_y !== 0) {
                this.step = (this.step + 1) % 2
                this.frame = WALK_FRAMES[this.dir][this.step]
            }

            this.sync()
        }
        // A remote sprite's position and frame arrive over the socket, so
        // it is never stepped locally

        this.draw()
    }

    sync() {
        const state = this.x + "," + this.y + "," + this.frame
        if (state === this.lastSent) { return }
        // Nothing changed this frame, so there's nothing to tell the server

        this.lastSent = state
        socket.emit("player-moved", { // Telling the server which player has moved and their coordinates
            x: this.x,
            y: this.y,
            frame: this.frame
        })
    }

    draw() {
        if (!spritesheet) {
            // The sheet is missing or still loading, so draw a placeholder
            // rather than nothing at all
            push()
            noStroke()
            fill(this.isLocal ? "#8ecae6" : "#ffb703")
            rect(this.x, this.y, DRAW_SIZE, DRAW_SIZE)
            pop()
            return
        }

        image(
            spritesheet,
            this.x, this.y, DRAW_SIZE, DRAW_SIZE,
            680 - (14 - this.frame) * TILE, (4 + this.ghost) * TILE, TILE, TILE
        )
    }
}

const player = new Sprite(10, 10, 2, socket.id)

players.push(player)

// One set of listeners for the whole page, driving this client's sprite
// only - a listener per sprite would stack up with every player that joins
const KEYS = {
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right"
}

function typingInLobbyBox(e) {
    return e.target && e.target.tagName === "INPUT"
    // Typing a lobby code shouldn't walk the sprite around
}

addEventListener("keydown", (e) => {
    if (typingInLobbyBox(e)) { return }
    const dir = KEYS[e.code]
    if (dir) { player.move(dir) }
})

addEventListener("keyup", (e) => {
    if (typingInLobbyBox(e)) { return }
    const dir = KEYS[e.code]
    if (dir) { player.stop(dir) }
})

async function setup() {
    createCanvas(windowWidth, windowHeight)
    frameRate(20)

    try {
        spritesheet = await loadImage("sprites.png")
    } catch (err) {
        console.warn("sprites.png could not be loaded, drawing placeholders", err)
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight)
}

function draw() {
    background(100) // A grey background

    for (let p = 0; p < players.length; p++) { players[p].animate() }
    // Spawning each player in the lobby
}
