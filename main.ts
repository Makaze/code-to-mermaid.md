import { Editor, Notice, Plugin } from 'obsidian';
import { convertPythonToMermaid } from "./tree.mjs";

interface PythonToMermaidPluginSettings {
    supported: Array<string>;
}

const DEFAULT_SETTINGS: PythonToMermaidPluginSettings = {
    supported: ['python']
}

const NOTICE_TYPE = `[Python to Mermaid]`;

export default class PythonToMermaidPlugin extends Plugin {
    settings: PythonToMermaidPluginSettings;

    findFencedBlock(editor: Editor, offset: number) {
        offset = offset || 0;
        const curLine = editor.getCursor().line + offset;
        const numLines = editor.lineCount();
        const rFence = /^\s*(```|~~~)(.*)/

        const isFence = (s: string) => rFence.test(s);

        // Find start
        let start = -1;
        let line: string = "";
        for (let l = curLine; l >= 0; l--) {
            line = editor.getLine(l);
            if (isFence(line)) {
                start = l;
                break;
            }
        }
        if (start === -1) {
            new Notice(`${NOTICE_TYPE} No start found`);
            return null;
        }

        const [_ignore, fence, lang] = line.match(rFence)!;

        // Find end
        let end = -1;
        for (let l = start + 1; l < numLines; l++) {
            line = editor.getLine(l);
            if (isFence(line)) {
                end = l;
                break;
            }
        }
        if (end === -1) {
            new Notice(`${NOTICE_TYPE} No end found`);
            return null;
        }

        const from = { line: start + 1, ch: 0 };
        const to = { line: end, ch: 0 };
        const content = editor.getRange(from, to);

        return { start, end, lang, content, from, to, fence };
    }

    appendGraph(editor: Editor) {
        const block = this.findFencedBlock(editor, 0);
        if (!block) {
            new Notice(`${NOTICE_TYPE} Place the cursor inside of a code block.`);
            return false;
        }

        const { end, lang, content, fence } = block;
        let from = { line: end + 1, ch: 0 }
        let to = { line: end + 1, ch: 0 }

        // Replace graph if it already exists
        const graph = this.findFencedBlock(editor, 3);
        if (graph && graph.lang === "mermaid") {
            to.line = graph.end + 1;
        }

        if (!this.settings.supported.includes(lang)) {
            new Notice(`${NOTICE_TYPE} Unsupported language: ${lang}`);
            return false;
        }

        const result = convertPythonToMermaid(content);
        editor.replaceRange(`\n${fence}mermaid\n${result.value}\n${fence}`, from, to);
    }

    async onload() {
        await this.loadSettings();

        // This adds an editor command that can perform some operation on the current editor instance
        this.addCommand({
            id: 'convert',
            name: 'Convert to Mermaid',
            editorCallback: (editor: Editor) => {
                this.appendGraph(editor);
            }

        });
    }

    async onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

