# Obsidian Code to Mermaid Plugin

This is a code visualization plugin for Obsidian (https://obsidian.md).

Currently only supports Python.

This project uses TypeScript to provide type checking and documentation for the Obsidian-specific code.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

This plugin exposes the following APIs:
- Adds a command "Convert to Mermaid" to the command pallette. Place your cursor inside of a `python` code block, such as:
  ```markdown
  ~~~python
  def a():
      print("test")
  ~~~
  ```
  and this command will add that program's flow chart below:
  ```mermaid
  flowchart TD
  2{"def a()"}
  7["print(#quot;test#quot;)"]
  2 -->|"call"| 7
  ```

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
