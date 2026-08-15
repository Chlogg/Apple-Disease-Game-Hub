This explains exactly what every command does, why it exists, and exactly where in your code it must be used for the engine to function correctly.

1. The Game Object Contract
Your factory function (e.g., function createMyGame()) must return an object with these four properties. The Hub engine uses this object to interface with your game.

el (HTMLCanvasElement)
What it is: The DOM canvas element where your game renders.
Where it must be used: Returned at the very end of your factory function inside the returned object.
How to use it: Create a canvas, configure its internal resolution (width/height), and pass it to UI.applyCanvasStyle(). Finally, return it as el. Do not append it to document.body yourself; the Hub handles that.
Example:
const c = document.createElement('canvas');
c.width = 400; c.height = 300;
UI.applyCanvasStyle(c, 400/300, 'My Game');
return { el: c, /* ... */ };

onKey(code) (Function)
What it is: An event listener fired exactly once when a key is pressed down.
Where it must be used: Returned as a method in the factory function's object.
How to use it: Use this for one-shot, discrete actions like jumping, shooting a bullet, or restarting the game after a Game Over. Do not use it for continuous movement (like walking), because it only fires once per keypress.
Parameters: code (String) - The raw KeyboardEvent.code (e.g., 'Space', 'KeyW'). You should compare this against your resolved KEYS object.
Example:
return {
  // ...
  onKey(code) {
    if (code === KEYS.jump) { player.vy = -10; }
    if (code === KEYS.restart && isGameOver) { resetGame(); }
  }
};

tick() (Function)
What it is: The main update loop, called exactly 60 times per second.
Where it must be used: Returned as a method in the factory function's object.
How to use it: This is the heart of your game. Put all physics calculations, enemy AI, collision detection, and canvas drawing (ctx.fillRect, etc.) inside this function. The Hub uses a fixed timestep accumulator, so this will run smoothly even on 144Hz monitors.
Example:
return {
  // ...
  tick() {
    // 1. Update Physics
    player.x += player.vx;
    // 2. Check Input (held down)
    if (Hub.keys[KEYS.moveRight]) player.vx = 5;
    // 3. Draw to canvas
    ctx.clearRect(0, 0, 400, 300);
    ctx.fillRect(player.x, player.y, 20, 20);
  }
};

destroy() (Function)
What it is: The cleanup function, called when the user closes or stops your game.
Where it must be used: Returned as a method in the factory function's object.
How to use it: You must remove your canvas from the DOM. If you added any event listeners to the window (e.g., for mouse tracking), you must remove them here to prevent memory leaks.
Example:
return {
  // ...
  destroy() {
    c.remove(); // Remove canvas
    window.removeEventListener('mousemove', onMouseMove); // Clean up custom listeners
  }
};

2. Hub (Core Engine & Input)
The central engine object. As a game developer, you primarily use it to check held-down key states.

Hub.keys (Object Property)
What it is: A live, read-only object mapping KeyboardEvent.code strings to booleans (true if held down, false or undefined if released).
Where it must be used: Inside your tick() function. Do not use it in onKey().
How to use it: Check this for continuous actions (like walking, running, or holding down a throttle). Always access it using your resolved KEYS object so custom user keybinds work.
Example:
tick() {
  if (Hub.keys[KEYS.moveLeft]) player.x -= 5;
  if (Hub.keys[KEYS.moveRight]) player.x += 5;
}
(Note: Hub.launch, Hub.stop, Hub.pause, Hub.resume are internal engine functions used by the UI/Compiler to manage game lifecycles. You should never call them directly from inside your game).

3. Store (Persistence & Bindings)
Handles all localStorage data. Use this to save high scores and get the user's customized keybinds.

Store.bindings.resolve(gameName)
What it is: Fetches the user's current keybinds for your game.
Where it must be used: At the very top of your factory function, before returning the game object.
How to use it: Call this once, storing the result in a const KEYS. It merges the default controls you set in the Compiler Config tab with any custom overrides the user set in the Settings UI. Because it is declared at the top of the factory, KEYS will be in scope for your onKey() and tick() methods.
Parameters: gameName (String) - The exact name of your game module.
Returns: An object like { jump: 'Space', restart: 'KeyR' }.
Example:
function createMyGame() {
  const KEYS = Store.bindings.resolve('My Game'); // MUST BE HERE
  const c = document.createElement('canvas');
  // ...
  return {
    el: c,
    onKey(code) { if (code === KEYS.jump) { /* ... */ } },
    // ...
  };
}

Store.scores.get(gameName)
What it is: Retrieves the saved high score.
Where it must be used: Usually inside your tick() function (to draw the score on the screen), or inside a reset/init function.
Parameters: gameName (String).
Returns: Integer. 0 if no score exists.
Example:
tick() {
  const best = Store.scores.get('My Game');
  ctx.fillText('HI: ' + best, 10, 20);
}

Store.scores.submit(gameName, score)
What it is: Attempts to save a new high score.
Where it must be used: Inside your game logic when the player dies, loses, or finishes a level. This is usually placed inside tick() within a game-over conditional block.
Parameters: gameName (String), score (Integer).
Returns: true if the score was higher than the previous record (useful for triggering a "New Record!" flashing effect), false otherwise.
Example:
tick() {
  if (player.dead) {
    const isNewRecord = Store.scores.submit('My Game', Math.floor(score));
    if (isNewRecord) flashScreen = true;
  }
}

4. UI (Window Manager)
The module that handles the visual desktop-style window wrapper.

UI.applyCanvasStyle(canvas, aspectRatio, gameName)
What it is: The function that registers your canvas with the Hub's floating window manager.
Where it must be used: Inside your factory function, immediately after creating the canvas and setting its width/height, but before returning the game object.
How to use it: You must call this in your factory function. It reads the user's display settings (window size slider, screen position) and builds the DOM window around your canvas.
Parameters:
- canvas: The canvas element you created.
- aspectRatio: The width divided by the height (e.g., 400/300 or 1.33). Used to calculate the exact pixel size.
- gameName: The name of your game (displayed in the window title bar).
Example:
function createMyGame() {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 300;
  UI.applyCanvasStyle(c, 400/300, 'My Game'); // MUST BE HERE
  // ...
  return { el: c };
}

5. Utils (Math & Rendering Helpers)
A static library of functions to make 2D game development easier.

Utils.drawPixels(ctx, x, y, scale, matrix, color)
What it is: Draws retro pixel art from a 2D array of 1s and 0s.
Where it must be used: Inside your tick() function, during the draw phase.
How to use it: Define your sprites as arrays at the top of your factory. 1 means draw a square, 0 means skip. All drawn squares will be the same color.
Parameters:
- ctx: Your canvas 2D context.
- x, y: The top-left pixel coordinates to start drawing.
- scale: The size of each pixel (e.g., 2 means each array cell becomes a 2x2 square).
- matrix: The 2D array.
- color: The fill style string (e.g., '#ff0000').
Example:
const PLAYER_SPRITE = [
  [0,1,0],
  [1,1,1],
  [0,1,0]
];
tick() {
  // Draws a 3x3 red cross at top-left
  Utils.drawPixels(ctx, 0, 0, 2, PLAYER_SPRITE, '#ff0000');
}

Utils.drawColorPixels(ctx, x, y, scale, matrix)
What it is: Draws multi-colored pixel art from a 2D array.
Where it must be used: Inside your tick() function, during the draw phase.
How to use it: Instead of 1s and 0s, each cell in the array contains a color string (e.g., '#fff') or 0 (skip).
Example:
const COIN = [
  ['#fff', '#fff'],
  ['#fff', '#ff0']
];
tick() {
  Utils.drawColorPixels(ctx, 10, 10, 4, COIN);
}

Utils.rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2)
What it is: Standard Axis-Aligned Bounding Box (AABB) collision detection.
Where it must be used: Inside your tick() function, during the physics/update phase (before drawing).
How to use it: Check if two rectangles overlap (e.g., player hitting an obstacle, bullet hitting an enemy).
Parameters: x, y (top-left), w, h (width/height) for both Box 1 and Box 2.
Returns: true if they overlap, false otherwise.
Example:
tick() {
  let hit = Utils.rectIntersect(
    player.x, player.y, 20, 20, // Player box
    enemy.x, enemy.y, 40, 40    // Enemy box
  );
  if (hit) player.dead = true;
}

Utils.prettyKey(code)
What it is: Converts raw browser codes into readable text.
Where it must be used: Inside your tick() function, usually when drawing "Game Over" text on the screen.
How to use it: If you want to draw "Press KeyR to Restart" on the screen, raw KeyR looks bad. This converts it to R.
Parameters: code (String) - Usually KEYS.actionName.
Returns: Formatted string.
Example:
tick() {
  if (isGameOver) {
    const text = 'Press ' + Utils.prettyKey(KEYS.restart) + ' to Restart';
    // Returns "Press R to Restart"
    ctx.fillText(text, 100, 150);
  }
}
