// OX (noughts and crosses) played inside a chat. The whole game is one message whose body holds the board.
//   board: 9 characters, '.' empty, 'x' or 'o'; x = who started (moves first), o = the other person
//   turn: whose move it is; winner: 'x' | 'o' | 'draw' | null; line: the three winning cells
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

export function newGame(xId, oId) {
  return { type: 'ox', board: '.........', x: xId, o: oId, turn: xId, winner: null, line: null, moves: 0 };
}

export function result(board) {
  for (const l of LINES) {
    const [a, b, c] = l;
    if (board[a] !== '.' && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: l };
  }
  return board.includes('.') ? { winner: null, line: null } : { winner: 'draw', line: null };
}

/** Plays a move. Returns the new game, or throws an Error whose .code explains why not. */
export function play(game, userId, cell) {
  const fail = (msg, code) => Object.assign(new Error(msg), { code });
  if (game.winner) throw fail('This game is over. Start a new one from the + menu.', 'game_over');
  if (!same(game.x, userId) && !same(game.o, userId)) throw fail("You're not playing in this game", 'not_player');
  if (!same(game.turn, userId)) throw fail("It's not your turn yet", 'not_your_turn');
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || game.board[cell] !== '.') throw fail('Pick an empty square', 'taken');
  const mark = same(game.x, userId) ? 'x' : 'o';
  const board = game.board.slice(0, cell) + mark + game.board.slice(cell + 1);
  const r = result(board);
  return { ...game, board, moves: (game.moves || 0) + 1, winner: r.winner, line: r.line, turn: r.winner ? null : mark === 'x' ? game.o : game.x };
}
