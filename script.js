const storage = document.querySelector(".collections");
const newGameForm = document.querySelector(".collections__form");
const newGameField = document.querySelector(".form-input");
const button = document.querySelector(".form-button");
const checkGameForm = document.querySelector("#check__form");
const checkGameField = document.querySelector("#collections__info-check-input");
const checkGameButton = document.querySelector(
  "#collections__info-check-button"
);
const amount = document.querySelector("#collections__info-amount");
const baseAmount = document.querySelector("#collections__info-base-amount");
const expAmount = document.querySelector("#collections__info-exp-amount");

class BaseGame {
  constructor(title) {
    this.title = title;
    this.minMaxPlayers = [];
    this.age = 0;
    this.rating = [];
    this.yourRating = 0;
    this.averageRating = 0;
    this.genre = [];
    this.isExpansion = false;
    this.image = "";
  }
  async fetchGameData(gameName) {
    try {
      const proxyUrl = "https://cors-anywhere.herokuapp.com/";
      const searchByTitle = `https://boardgamegeek.com/xmlapi2/search?query=${gameName}&type=boardgame&exact=1`;
      const titleResp = await fetch(proxyUrl + searchByTitle);
      const titleData = await titleResp.text();
      const parser = new DOMParser();
      const titleXmlDoc = parser.parseFromString(titleData, "application/xml");
      const primaryNameElement = titleXmlDoc.querySelector(
        'name[type="primary"]'
      );
      const id = primaryNameElement.parentElement.getAttribute("id");
      const searchById = `https://boardgamegeek.com/xmlapi/boardgame/${id}?&stats=1`;
      const idResp = await fetch(proxyUrl + searchById);
      const idData = await idResp.text();
      return parser.parseFromString(idData, "application/xml");
    } catch (error) {
      console.error("Fetch failed: ", error);
      alert("Invalid input");
    }
  }
  async getGameCharacteristics(gameName) {
    const idXmlDoc = await this.fetchGameData(gameName);
    const usersAverageRating = idXmlDoc.querySelector("average").textContent;
    const minPlayers = idXmlDoc.querySelector("minplayers").textContent;
    const maxPlayers = idXmlDoc.querySelector("maxplayers").textContent;
    const playerAge = idXmlDoc.querySelector("age").textContent;
    const category = Array.from(
      idXmlDoc.querySelectorAll("boardgamecategory")
    ).map((item) => item.innerHTML);
    const img = idXmlDoc.querySelector("image").textContent;

    this.rating.push(+usersAverageRating);
    this.minMaxPlayers.push(+minPlayers, +maxPlayers);
    this.age = playerAge;
    this.genre.push(category);
    this.isExpansion =
      idXmlDoc.querySelectorAll("boardgameexpansion").length === 1 ||
      this.genre.some((genre) => genre.includes("Expansion for Base-game"));

    this.image = img;
  }
  setMyRaiting(mark) {
    if (mark >= 0 && mark <= 10) {
      this.rating[1] = mark;
      this.yourRating = mark;
      renderCollection(this)
    }
  }
  fillData(minMaxPlayers = "", age = "", genres) {
    if (minMaxPlayers !== "" && /^\d+-\d+$/.test(minMaxPlayers)) {
      this.minMaxPlayers = minMaxPlayers.split("-");
    } else {
      alert("Invalid input");
    }
    if (age !== "" && age >= 0) {
      this.age = age;
    }
    if (genres !== "") {
      this.genre = genres;
    }
    renderCollection(this);
  }

  addGenre(category) {
    if (!this.genre.includes(category)) {
      this.genre.push(category);
      renderCollection(this);
    }
  }
  countRaiting() {
    const finalRating =
      this.rating.reduce(
        (accumulator, currentValue) => accumulator + currentValue,
        0
      ) / this.rating.length;
    this.averageRating = finalRating.toFixed(2);
  }
}

class Expansion extends BaseGame {
  constructor(title) {
    super(title);
    this.baseGame = "";
  }
  getBaseGameName() {
    return this.baseGame;
  }
  async getGameCharacteristics(gameName) {
    await super.getGameCharacteristics(gameName);
    const idXmlDoc = await this.fetchGameData(gameName);
    const expansion = idXmlDoc.querySelector("boardgameexpansion");
    this.baseGame = expansion.textContent;
  }
}

class Collection {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.gameList = [];
  }

  addItem(item) {
    if (!this.gameList.some((game) => game.title === item.title)) {
      this.gameList.push(item);
    } else {
      const index = this.gameList.findIndex((i) => i === item);
      if (index !== -1) {
        this.gameList[index] = item;
      }
    }
  }
  isInCollection(title) {
    return this.gameList.some((game) => game.title === title);
  }
  countList() {
    return this.gameList.length;
  }
  countBaseGames() {
    return this.gameList.filter(
      (game) => game instanceof BaseGame && !(game instanceof Expansion)
    ).length;
  }
  countExpansions() {
    return this.gameList.filter((game) => game instanceof Expansion).length;
  }
}

const games = [];
function pushGame() {
  if (!games.includes(newGameField.value) && newGameField.value !== "") {
    games.push(newGameField.value);
  }
  newGameField.value = "";
  run();
}
button.addEventListener("click", pushGame);
newGameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  pushGame();
});
const myCollection = new Collection("Board Games");
async function run() {
  await Promise.all(
    games.map(async (item) => {
      const game = new BaseGame(item);
      let savedRating = 0;
      let savedPlayers = 0;
      let savedAge = 0;
      let savedGenre = "";
      const existingKey = Object.keys(localStorage).find((key) => {
        const gameData = JSON.parse(localStorage.getItem(key));
        return gameData.title === game.title;
      });

      if (existingKey) {
        const savedGame = JSON.parse(localStorage.getItem(existingKey));
        savedRating = savedGame.yourRating;
        savedPlayers = savedGame.minMaxPlayers;
        savedAge = savedGame.age;
        savedGenre = savedGame.genre;
      }

      await game.getGameCharacteristics(item);
      const newGame = game.isExpansion
        ? new Expansion(item)
        : new BaseGame(item);
      await newGame.getGameCharacteristics(item);
      newGame.yourRating = savedRating;
      if (savedPlayers) newGame.minMaxPlayers = savedPlayers;
      if (savedAge) newGame.age = savedAge;
      if (savedGenre) newGame.genre = savedGenre;
      newGame.countRaiting();
      myCollection.addItem(newGame);
      renderCollection(newGame);
      saveToLocalStorage(newGame);
      renderCollectionsInfo();
    })
  );
}

function renderCollection(game) {
  let collection = document.querySelector(`[data-title="${game.title}"]`);
  if (!collection) {
    collection = document.createElement("div");
    collection.classList.add("collections__item");
    collection.setAttribute("data-title", game.title);
  }
  collection.innerHTML = `
<h3>${game.title}</h3>
<img src="${game.image}" alt="${game.title}" class="collections__img">
<div class="collections__div">
<p class="collections__div-p">Title: ${game.title}</p>
<p class="collections__div-p" id = "collections__min-max-payers">Players: ${
    game.minMaxPlayers[0]
  }-${game.minMaxPlayers[1]}</p>
<p class="collections__div-p" id = "collections__age">Age: ${game.age}+</p>
<p class="collections__div-p" id = "collections__your-rate">Your Rating: ${
    game.yourRating
  }/10</p>
<p class="collections__div-p" id = "collections__average">Average Rating: ${
    game.averageRating
  }/10</p>
<form class="rating">
<input type="number" step="0.01" min="0" max="10" placeholder="Your mark" id="rating__input">
<button type="button" class="rating__button">Rate</button>
</form>
<p class="collections__div-p" id = "collections__genre">Genre: ${game.genre.join(
    ", "
  )}</p>
<form id ="genre__form">
<input placeholder = "Add new genre" id = "add-to-genre-list__input">
<button type = "button" id = "add-to-genre-list__button">Add</button>
</form>
<h4>Change game characteristics:</h4>
<form>
<input placeholder = "Players (min-max)" id = "min-max__input">
<input type = "number" min = "0" placeholder = "Change age mark" id = "age__input">
<input placeholder = "Change genres" id = "genre__input">
<button type = "button" id="data__button">Change</button>
</form>
<button type="button" id="delete">Delete</button>
</div>
`;
  const yourRatingP = collection.querySelector("#collections__your-rate");
  const averageP = collection.querySelector("#collections__average");
  function updateRating() {
    yourRatingP.textContent = `Your Rating: ${game.yourRating}/10`;
    averageP.textContent = `Average Rating: ${game.averageRating}/10`;
    myCollection.addItem(game);
    saveToLocalStorage(game);
  }
  if (game instanceof Expansion) {
    collection.classList.add("collections__item-expansion");
    collection.innerHTML += `<p class="collections__div-p">This is an expansion of: ${game.baseGame}</p>`;
  }
  const ratingField = collection.querySelector("#rating__input");
  const ratingButton = collection.querySelector(".rating__button");
  const ratingForm = collection.querySelector(".rating");
  storage.append(collection);
  function provideRate() {
    const rating = +ratingField.value;
    if (ratingField.value !== "") {
      game.setMyRaiting(+rating.toFixed(2));
    }
    ratingField.value = "";
    game.countRaiting();
    updateRating();
  }
  ratingButton.addEventListener("click", provideRate);
  ratingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    provideRate();
  });
  const minMaxPlayersField = collection.querySelector("#min-max__input");
  const ageField = collection.querySelector("#age__input");
  const genreField = collection.querySelector("#genre__input");
  const fillDataButton = collection.querySelector("#data__button");
  fillDataButton.addEventListener("click", () => {
    const minMax = minMaxPlayersField.value;
    const age = ageField.value;
    let genre = genreField.value.split(", ");
    if (genre.includes("")) {
      genre = "";
    }
    game.fillData(minMax, age, genre);
    myCollection.addItem(game);
  });
  const addGenreField = collection.querySelector("#add-to-genre-list__input");
  const addGenreButton = collection.querySelector("#add-to-genre-list__button");
  const addGenreForm = collection.querySelector("#genre__form");
  function provideNewGenre() {
    if (addGenreField.value !== "") {
      game.addGenre(addGenreField.value);
      myCollection.addItem(game);
    }
  }
  addGenreButton.addEventListener("click", provideNewGenre);
  addGenreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    provideNewGenre();
  });
  const deleteButton = collection.querySelector("#delete");
  const index = games.indexOf(game.title);
  deleteButton.addEventListener("click", () => {
    collection.remove();
    if (index !== -1) {
      games.splice(index);
    }
    localStorage.removeItem(`game${game.title}`);
    localStorage.setItem(
      "games",
      JSON.stringify(
        JSON.parse(localStorage.getItem("games")).filter(
          (item) => item !== game.title
        )
      )
    );
    myCollection.gameList = myCollection.gameList.filter(
      (item) => item.title !== game.title
    );
    renderCollectionsInfo();
  });
  function saveElementPosition(){
    const referenceEl = storage.children[index];
    storage.insertBefore(collection, referenceEl)
  }
  saveElementPosition();
  saveToLocalStorage(game);
}
function checkGame() {
  if (checkGameField.value !== "true" && checkGameField.value !== "false")
    checkGameField.value = myCollection.isInCollection(checkGameField.value);
}
checkGameButton.addEventListener("click", checkGame);
checkGameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  checkGame();
});
function renderCollectionsInfo() {
  amount.textContent = `Total Games in collection: ${myCollection.countList()}`;
  baseAmount.textContent = `Base-Games in collection: ${myCollection.countBaseGames()}`;
  expAmount.textContent = `Expansions in collection: ${myCollection.countExpansions()}`;
}

function saveToLocalStorage(newGame) {
  const existingKey = Object.keys(localStorage).find((key) => {
    const gameData = JSON.parse(localStorage.getItem(key));
    return gameData.title === newGame.title;
  });

  if (existingKey) {
    localStorage.removeItem(existingKey);
  }

  localStorage.setItem(`game${newGame.title}`, JSON.stringify(newGame));
  if (!games.includes(newGame.title)) {
    games.push(newGame.title);
  }
  localStorage.setItem("games", JSON.stringify(games));
}

function loadFromLocalStorage() {
  const gamesArr = JSON.parse(localStorage.getItem("games"));
  if (gamesArr) {
    gamesArr.forEach((element) => {
      const savedGame = localStorage.getItem(`game${element}`);
      if (savedGame) {
        const gameData = JSON.parse(savedGame);
        const game = gameData.isExpansion
          ? new Expansion(gameData.title)
          : new BaseGame(gameData.title);
        game.minMaxPlayers = gameData.minMaxPlayers;
        game.age = gameData.age;
        game.genre = gameData.genre;
        game.averageRating = gameData.averageRating;
        game.rating = gameData.rating;
        game.yourRating = gameData.yourRating;
        game.isExpansion = gameData.isExpansion;
        game.image = gameData.image;
        game.baseGame = gameData.baseGame;
        games.push(game.title);
        renderCollection(game);
        myCollection.addItem(game);
      }
    });
  }
}

loadFromLocalStorage();
renderCollectionsInfo();
