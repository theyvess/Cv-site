const socket = io("http://localhost:5000")

const msg = "client connected succesfully"

const joinLobbyBtn = document.getElementById("join-btn")
const lobbyInput = document.getElementById("lobby-num")

let clientUniqueId = null
let players = []

function createLobby(){
    socket.emit("create-lobby")
}

// Asking server for a lobby

function joinLobby(){
    clientUniqueId = lobbyInput.value
    socket.emit("join-lobby", {roomUniqueId: clientUniqueId})

    // clients unique id is what was input
}




// When joining the lobby set the id to whatever was input

socket.on("new-lobby", (data) => {
    clientUniqueId = data.roomUniqueId // client lobby host's id is the lobby's id we got from the server
    console.log("waiting for a player to join, lobby code " + clientUniqueId)
})

socket.on("players-connected", (data) => {

    if (data && data.joinedPlayerId === socket.id){return}
    // Don't let the lobby host join their own lobby

    const newPlayer = new Sprite(10, 10, 3, data.joinedPlayerId)
    players.push(newPlayer)
    // Adds the joiner to the playerlist
})
// Spawning a new player when a player connects

socket.on("connect", () => {
    console.log("Your id: " + socket.id)

    player.id = socket.id
})

// Prints a message when the client connects
// Synchronising the player id to be the socket id everytime a connection occurs

socket.on("friend-moved", (data) => {
    // The moving friend's coordinates are updated
    for (let p = 0; p < players.length; p++) {
        if (players[p].id === data.id){
            players[p].x = data.x
            players[p].y = data.y
            players[p].frame = data.frame
        }
    }
})

let spritesheet
async function setup() {
    createCanvas(windowWidth, windowHeight)
    spritesheet = await loadImage("sprites.png")

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

        this.up = false
        this.down = false
        this.left = false
        this.right = false

        addEventListener("keydown", (e) => {
            if (this.id !== socket.id){return}
            // Don't let one client control every other sprite
            switch (e.code) {
                case "KeyW":
                    this.vel_y = -5; this.vel_x = 0;
                    this.up = true; this.down = false; this.left = false; this.right = false
                    break;
                case "KeyS":
                    this.vel_y = 5; this.vel_x = 0;
                    this.down = true; this.up = false; this.left = false; this.right = false
                    break
                case "KeyA":
                    this.vel_x = -5; this.vel_y = 0;
                    this.left = true; this.up = false; this.down = false; this.right = false
                    break;
                case "KeyD":
                    this.vel_x = 5; this.vel_y = 0;
                    this.right = true; this.up = false; this.down = false; this.left = false
                    break;
        }})

        addEventListener("keyup", (e) => {
            if (this.id !== socket.id){return}
            // Don't let one client control every other sprite
            switch (e.code) {
                case "KeyW":
                    this.frame++; this.frame %= 2
                    if (this.frame == 0){this.frame = 4}
                    else if (this.frame == 1){this.frame = 5} break
                case "KeyS":
                    this.frame++; this.frame %= 2
                    if (this.frame == 0){this.frame = 6}
                    if (this.frame == 1){this.frame = 7} break
                case "KeyA":
                    this.frame++; this.frame %= 2
                    if (this.frame == 0){this.frame = 2}
                    if (this.frame == 1){this.frame = 3} break
                case "KeyD":
                    this.frame++; this.frame %= 2
                    break;
        }})
        /* Removing horizontal velocity when it moves
        vertically so there's no diagonal movement */
        /* Removing vertical velocity when
        it moves horizontally for the same reason */
    }

    animate(){ // Call this in the draw() function
        this.x += this.vel_x; this.y += this.vel_y
        // The lines above should be kept in the animate function
        if (this.id === socket.id){
            socket.emit("player-moved", { // Telling the server which player has moved and their coordinates
                roomUniqueId: clientUniqueId || socket.id,
                x: this.x,
                y: this.y,
                frame: this.frame
            })
        }

        image(spritesheet, this.x, this.y, 32, 32, 680 -(14 - this.frame) * 16, (4 + this.ghost) * 16, 16, 16)
        switch (true){
            case this.up:
                this.frame++; this.frame %= 2
                if (this.frame == 0){this.frame = 4}
                else if (this.frame == 1){this.frame = 5} break
            case this.down:
                this.frame++; this.frame %= 2
                if (this.frame == 0){this.frame = 6}
                if (this.frame == 1){this.frame = 7} break
            case this.left:
                this.frame++; this.frame %= 2
                if (this.frame == 0){this.frame = 2}
                if (this.frame == 1){ this.frame = 3} break
            case this.right:
                this.frame++; this.frame %= 2; break
        }
    }
}

const player = new Sprite(10, 10, 2, socket.id)


players.push(player)
function draw() {
    background(100) // A grey background

    for (let p = 0; p < players.length; p++){players[p].animate()}
   // Spawning each player in the lobby
    frameRate(20)
}
