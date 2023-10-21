const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
require('dotenv').config();

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
    console.log("emit to gameId", gameId)
    io.to(gameId).emit("game update", game);
  }

  function checkResult() {
    const game = games[gameId];
    const player1 = game.players[0];
    const player2 = game.players[1];

    console.log(player1.choice, player2.choice)

    if (!player1.choice || !player2.choice) {
      return;
    }

    console.log("check result", player1.choice, player2.choice)

    if (player1.choice === player2.choice) {
      game.result = "draw";
    } else if (
      (player1.choice === "rock" && player2.choice === "scissor") ||
      (player1.choice === "paper" && player2.choice === "rock") ||
      (player1.choice === "scissor" && player2.choice === "paper")
    ) {
      game.result = player1.id;
      player1.score++;
    } else {
      game.result = player2.id;
      player2.score++;
    }

    sendGameUpdate();
  }

  function getGameUser() {
    // console.log("games[gameId]?.players", games[gameId]?.players)
    // console.log("result", games[gameId]?.players.find((p) => p.id === user.id))
    return games[gameId]?.players.find((p) => p.id === user.id)
  }

  function checkGame() {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      throw new Error("Game not found");
    }
  }

  function handleError(error) {
    console.error(error);
    socket.emit("error", error.message);
  }

  socket.on("ping", () => {
    console.log("get user", getGameUser())
  });

  socket.on("connect user", (id, name) => {
    try {
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
    } catch (error) {
      handleError(error);
    }
  })

  socket.on("create game", () => {
    try {
      console.log("user", user)
      if (!user.id || !user.name) {
        socket.emit("user not found");
        return;
      }
      gameId = generateGameId();
      games[gameId] = {
        players: [
          {
            id: user.id,
            name: user.name,
            score: 0,
            choice: null,
            role: "host",
            socketId: socket.id,
          }
        ],
        result: null,
      };
      socket.join(gameId);
      socket.emit("game created", gameId);
    } catch (error) {
      handleError(error);
    }
  });

  socket.on("join game", (newGameId) => {
    try {
      const game = games[newGameId];
      gameId = newGameId;

      checkGame();

      const player = getGameUser();
      if (!player) {
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
          socketId: socket.id,
        });
      } else {
        player.socketId = socket.id;
      }

      socket.join(gameId);
      socket.emit("game joined", games[gameId]);
      sendGameUpdate();
    } catch (error) {
      handleError(error);
    }
  });

  socket.on("set choice", (choice) => {
    try {
      checkGame();

      getGameUser().choice = choice;
      if (choice) {
        checkResult();
      }
    } catch (error) {
      handleError(error);
    }
  });

  socket.on("continue", () => {
    try {
      console.log("continue")
      const game = games[gameId];

      checkGame();

      game.result = null;
      game.players.forEach(player => {
        player.choice = null;
      });
      sendGameUpdate();
    } catch (error) {
      handleError(error);
    }
  });

  socket.on("reset", () => {
    try {
      const game = games[gameId];

      checkGame();

      game.result = null;
      game.players.forEach(player => {
        player.choice = null;
        player.score = 0;
      });
      sendGameUpdate();
    } catch (error) {
      handleError(error);
    }
  });
});

// Fonction pour générer un ID de partie unique
function generateGameId() {
  return Math.random().toString(16).slice(2, 6).toUpperCase();
}

function generateUserId() {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

const PORT = process.env.PORT || 4545;
server.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
