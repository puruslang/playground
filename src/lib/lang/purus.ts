/**
 * Purus language mode for CodeMirror 6 via StreamLanguage.
 * Token names align with purus.tmLanguage.json scope categories.
 */
import { StreamLanguage } from '@codemirror/language';
import type { StreamParser } from '@codemirror/language';

// ── token sets (from purus.tmLanguage.json) ──────────────────────────────

/** storage.type → keyword */
const DECL = new Set(['const', 'let', 'var']);

/** keyword.control.* → keyword */
const CONTROL = new Set([
	'if','elif','else','unless','then',
	'while','until','do','for','in','range',
	'switch','case','match','when','default',
	'try','catch','finally',
	'return','break','continue','throw','yield',
	'import','from','export','require','use','namespace','public','all','with',
]);

/** storage.type.function → keyword (dimmer purple) */
const FN_KW = new Set(['fn','function','async']);

/** keyword.operator.* → operator */
const OPERATORS = new Set([
	'be','eq','to',
	'not','neq',
	'add','sub','mul','div','fdiv','mod','neg','pow',
	'lt','gt','le','ge',
	'and','or',
	'band','bor','bxor','bnot','shl','shr','ushr',
	'coal','pipe',
]);

/** keyword.other.type → meta */
const TYPE_KW = new Set(['as','of','gives','typeof','instanceof','type']);

/** constant.language → atom */
const ATOMS = new Set(['true','false','null','nil','undefined','nan','infinity']);

/** keyword.other → keyword2 */
const OTHER_KW = new Set(['new','delete','this','await','super','void','blank']);

/** support.type → type */
const SUPPORT = new Set(['list','object']);

// ── parser state ──────────────────────────────────────────────────────────
interface State {
	inTripleString: boolean;
	inSemiString: boolean;
	inBlockComment: boolean;
}

// ── StreamParser ──────────────────────────────────────────────────────────
const parser: StreamParser<State> = {
	name: 'purus',

	startState: (): State => ({
		inTripleString: false,
		inSemiString: false,
		inBlockComment: false,
	}),

	token(stream, state): string | null {
		// ── Inside block comment ---...--- ──
		if (state.inBlockComment) {
			if (stream.match('---')) { state.inBlockComment = false; return 'comment'; }
			stream.next();
			return 'comment';
		}

		// ── Inside //;...;// string ──
		if (state.inSemiString) {
			if (stream.match(';//')) { state.inSemiString = false; return 'string'; }
			if (stream.eat('\\')) { stream.next(); }
			else { stream.next(); }
			return 'string';
		}

		// ── Inside ///.../// string ──
		if (state.inTripleString) {
			if (stream.match('///')) { state.inTripleString = false; return 'string'; }
			if (stream.eat('\\')) { stream.next(); }
			else { stream.next(); }
			return 'string';
		}

		// ── Whitespace ──
		if (stream.eatSpace()) return null;

		// ── Block comment --- ──
		if (stream.match('---')) {
			state.inBlockComment = true;
			stream.skipToEnd();
			return 'comment';
		}

		// ── Line comment -- ──
		if (stream.match('--')) {
			stream.skipToEnd();
			return 'comment';
		}

		// ── //;...;// string ──
		if (stream.match('//;')) { state.inSemiString = true; return 'string'; }

		// ── ///.../// string ──
		if (stream.match('///')) { state.inTripleString = true; return 'string'; }

		// ── Regex ──
		if (stream.peek() === '/' && !stream.match('//', false)) {
			stream.next();
			while (!stream.eol()) {
				if (stream.peek() === '\\') { stream.next(); stream.next(); continue; }
				if (stream.eat('/')) break;
				stream.next();
			}
			stream.eatWhile(/[gimsuy]/);
			return 'string-2';
		}

		// ── Numbers ──
		if (stream.match(/^0[xX][0-9a-fA-F]+n?/)) return 'number';
		if (stream.match(/^0[bB][01]+n?/)) return 'number';
		if (stream.match(/^\d+(?:\.\d+)?n?/)) return 'number';

		// ── Identifiers / keywords ──
		if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_\-]*/)) {
			const w = stream.current();
			if (DECL.has(w))     return 'keyword';
			if (FN_KW.has(w))    return 'def';          // purple, fn name highlight
			if (CONTROL.has(w))  return 'keyword';
			if (OPERATORS.has(w)) return 'operator';
			if (TYPE_KW.has(w))  return 'type';
			if (ATOMS.has(w))    return 'atom';
			if (OTHER_KW.has(w)) return 'keyword';
			if (SUPPORT.has(w))  return 'builtin';
			return 'variable';
		}

		// ── Punctuation ──
		if (stream.match(/^[[\].,;\\]/)) return 'punctuation';

		stream.next();
		return null;
	},

	languageData: {
		commentTokens: { line: '--', block: { open: '---', close: '---' } },
	},
};

export const purusLanguage = StreamLanguage.define(parser);
