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

// Structure de données pour les parties en cours
const games = {};

io.on("connection", (socket) => {
  console.log("Un joueur s'est connecté", socket.id);
  let gameId = null;

  function sendGameUpdate() {
    const game = games[gameId];
    const gameData = {
      players: {},
      result: game.result,
    };
    Object.keys(game.players).forEach((playerId) => {
      const player = game.players[playerId];
      gameData.players[playerId] = {
        name: player.name,
        score: player.score,
        choice: player.choice,
      };
    });
    socket.to(gameId).emit("game update", gameData);
  }

  function checkResult() {
    const game = games[gameId];
    const player1 = game.players[Object.keys(game.players)[0]];
    const player2 = game.players[Object.keys(game.players)[1]];

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

  socket.on("ping", () => {
    console.log("pong");
    socket.emit("pong");
  });

  socket.on("create game", () => {
    const gameId = generateGameId();
    games[gameId] = {
      players: {
        [socket.id]: {
          socket,
          name: "Player 1",
          score: 0,
          choice: null,
          role: "host",
        },
      },
      result: null,
      gameMode: "multiplayer",
    };
    socket.join(gameId);
    gameId = gameId;
    socket.emit("game created", gameId);
  });

  socket.on("join game", (gameId) => {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    // check if game is full
    if (Object.keys(game.players).length >= 2) {
      socket.emit("game full");
      return;
    }
    game.players[socket.id] = {
      socket,
      name: "Player 2",
      score: 0,
      choice: null,
      role: "guest",
    };
    socket.join(gameId);
    gameId = gameId;
    socket.emit("game joined", gameId);
    sendGameUpdate();
  });

  socket.on("set name", (name) => {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    game.players[socket.id].name = name;
    sendGameUpdate();
  });

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
