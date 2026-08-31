const path = require("path")
const http = require("http")
const express = require("express")
const { Server } = require("socket.io")

const PORT = process.env.PORT || 5000

const app = express()
app.use(express.static(path.join(__dirname, "public")))

const server = http.createServer(app)
const io = new Server(server, {
    cors: { origin: "*" } // The page can be served from another dev server
})

// roomUniqueId -> Set of socket ids currently in that lobby
const lobbies = new Map()

function makeLobbyId() {
    let id
    do { id = String(Math.floor(1000 + Math.random() * 9000)) } while (lobbies.has(id))
    return id
}

function roster(roomUniqueId) {
    return [...(lobbies.get(roomUniqueId) || [])]
}

function leaveLobby(socket) {
    const roomUniqueId = socket.data.roomUniqueId
    if (!roomUniqueId) { return }

    const lobby = lobbies.get(roomUniqueId)
    if (lobby) {
        lobby.delete(socket.id)
        if (lobby.size === 0) { lobbies.delete(roomUniqueId) }
    }

    socket.leave(roomUniqueId)
    socket.data.roomUniqueId = null
    io.to(roomUniqueId).emit("player-left", { id: socket.id, players: roster(roomUniqueId) })
}

io.on("connection", (socket) => {
    console.log("client connected: " + socket.id)

    socket.on("create-lobby", () => {
        leaveLobby(socket)

        const roomUniqueId = makeLobbyId()
        lobbies.set(roomUniqueId, new Set([socket.id]))
        socket.join(roomUniqueId)
        socket.data.roomUniqueId = roomUniqueId

        socket.emit("new-lobby", { roomUniqueId })
        // The host also needs the roster, so every client learns about
        // everyone else through a single event
        io.to(roomUniqueId).emit("players-connected", {
            joinedPlayerId: socket.id,
            players: roster(roomUniqueId)
        })
    })

    socket.on("join-lobby", (data) => {
        const roomUniqueId = data && data.roomUniqueId

        if (!roomUniqueId || !lobbies.has(roomUniqueId)) {
            socket.emit("lobby-error", { message: "No lobby with code " + roomUniqueId })
            return
        }
        if (socket.data.roomUniqueId === roomUniqueId) { return }

        leaveLobby(socket)
        lobbies.get(roomUniqueId).add(socket.id)
        socket.join(roomUniqueId)
        socket.data.roomUniqueId = roomUniqueId

        socket.emit("lobby-joined", { roomUniqueId })
        io.to(roomUniqueId).emit("players-connected", {
            joinedPlayerId: socket.id,
            players: roster(roomUniqueId)
        })
    })

    socket.on("player-moved", (data) => {
        const roomUniqueId = socket.data.roomUniqueId
        if (!roomUniqueId || !data) { return }

        // The room comes from the server's own record, never from the
        // client, so a client cannot move a sprite in someone else's lobby
        socket.to(roomUniqueId).emit("friend-moved", {
            id: socket.id,
            x: data.x,
            y: data.y,
            frame: data.frame
        })
    })

    socket.on("leave-lobby", () => leaveLobby(socket))

    socket.on("disconnect", () => {
        leaveLobby(socket)
        console.log("client disconnected: " + socket.id)
    })
})

server.listen(PORT, () => console.log("listening on http://localhost:" + PORT))
