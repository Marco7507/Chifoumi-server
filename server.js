const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

const games = {};

io.on("connection", (socket) => {
  //console.log("new connection", socket.id);

  let gameId = null;
  let user = {
    id: "",
    name: "",
  }

  function sendGameUpdate() {
    const game = games[gameId];
    //console.log("send update game", game)
    socket.to(gameId).emit("game update", game);
  }

  function checkResult() {
    const game = games[gameId];
    const player1 = game.players[0];
    const player2 = game.players[0];

    if (player1.choice === player2.choice) {
      game.result = "draw";
    } else if (
      (player1.choice === "rock" && player2.choice === "scissors") ||
      (player1.choice === "paper" && player2.choice === "rock") ||
      (player1.choice === "scissors" && player2.choice === "paper")
    ) {
      game.result = player1.socket.id;
      player1.score++;
    } else {
      game.result = player2.socket.id;
      player2.score++;
    }

    sendGameUpdate();
  }

  function getGameUser() {
    // console.log("games[gameId]?.players", games[gameId]?.players)
    // console.log("result", games[gameId]?.players.find((p) => p.id === user.id))
    return games[gameId]?.players.find((p) => p.id === user.id)
  }

  socket.on("ping", () => {
    console.log("get user", getGameUser())
  });

  socket.on("connect user", (id, name) => {
    console.log("connect user", id, name)
    if (!id) {
      id = generateUserId();
    }
    if (!name) {
      name = `Player-${id}`
    } 
    user = {
      id,
      name
    }
    socket.emit("connected", user);
  })

  socket.on("create game", () => {
    gameId = generateGameId();
    console.log("user", user)
    games[gameId] = {
      players: [
        {
          id: user.id,
          name: user.name,
          score: 0,
          choice: null,
          role: "host"
        }
      ],
      result: null,
    };
    socket.join(gameId);
    socket.emit("game created", gameId);
  });

  socket.on("join game", (newGameId) => {
    const game = games[newGameId];
    gameId = newGameId;

    if (!game) {
      socket.emit("game not found");
      return;
    }
    if (!getGameUser()) {
      if (game.players.length >= 2) {
        socket.emit("game full");
        return;
      }
      game.players.push({
        id: user.id,
        name: user.name,
        score: 0,
        choice: null,
        role: "guest",
      });
    }
    
    socket.join(gameId);
    socket.emit("game joined", games[gameId]);
    sendGameUpdate();
  });

  // socket.on("set name", (name) => {
  //   const game = games[gameId];
  //   if (!game) {
  //     socket.emit("game not found");
  //     return;
  //   }
  //   game.players[socket.id].name = name;
  //   sendGameUpdate();
  // });

  socket.on("set choice", (choice) => {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    game.players[socket.id].choice = choice;
    if (choice) {
      checkResult();
    }
    sendGameUpdate();
  });

  socket.on("continue", () => {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    game.result = null;
    Object.keys(game.players).forEach((playerId) => {
      game.players[playerId].choice = null;
    });
    sendGameUpdate();
  });

  socket.on("reset", () => {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    game.result = null;
    Object.keys(game.players).forEach((playerId) => {
      game.players[playerId].choice = null;
      game.players[playerId].score = 0;
    });
    sendGameUpdate();
  });
});

// Fonction pour générer un ID de partie unique
function generateGameId() {
  return Math.random().toString(16).slice(2, 6).toUpperCase();
}

function generateUserId() {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
