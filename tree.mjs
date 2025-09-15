import { parser } from "@lezer/python";

function annotateTree(tree, code) {
    const cursor = tree.cursor();

    const nodes = [];
    const edges = {};

    let next_id = 0;
    let from_id = false;
    const end_points = {};
    let last_parent = false;

    const parent_types = [
        "Script",
        "ForStatement",
        "WhileStatement",
        "TryStatement",
        "IfStatement",
        "MatchStatement",
        "ClassDefinition",
        "FunctionDefinition",
        "WithStatement",
    ];
    const def_parents = ["ClassDefinition", "FunctionDefinition"];
    const loop_parents = ["ForStatement", "WhileStatement"];
    const continues = [
        "ContinueStatement",
        "ReturnStatement",
        "YieldStatement",
    ];
    const breaks = ["BreakStatement"];
    const cond_parents = [
        "IfStatement",
        "WhileStatement",
        "ForStatement",
        "MatchStatement",
        "TryStatement",
    ];
    const control_types = [
        "for",
        "while",
        "if",
        "elif",
        "else",
        "try",
        "except",
        "finally",
        "def",
        "class",
        "match",
        "case",
        "with",
    ];
    const cond_types = [
        "for",
        "while",
        "if",
        "elif",
        "else",
        "match",
        "case",
        "except",
    ];
    const exclusives = ["elif", "else", "except", "case"];
    const def_types = ["def", "class"];
    const single_word_controls = ["try", "else", "finally"];

    function get_last_statement(node) {
        do {
            if (node.last_statement) {
                return node.last_statement;
            }
        } while (node = node.parent);
        return false;
    }

    function get_parent(node, filter) {
        do {
            if (filter.includes(node.parent.type)) {
                return node.parent;
            }
        } while (node = node.parent);
        return false;
    }

    function add_end(parent_id, end_object) {
        if (!end_object.id) throw new Error("Invalid endpoint");
        if (!parent_id) throw new Error("Invalid endpoint");
        end_points[parent_id].push(end_object);
    }

    function add_edge(from_id, to_id, edge_name) {
        if (!nodes[from_id]) {
            throw new Error("Invalid from id");
        }
        if (!nodes[to_id]) {
            throw new Error("Invalid to id");
        }
        let old_edge = edges[[from_id, to_id]];
        let edge = {
            "from": nodes[from_id],
            "to": nodes[to_id],
            "name": edge_name,
        };
        if (old_edge) console.error("old edge", { ...old_edge });

        edges[[from_id, to_id, edge_name]] = edge;
    }

    function walk() {
        const id = next_id++;
        const node = {
            id,
            type: cursor.type.name,
            from: cursor.from,
            to: cursor.to,
            begin: false,
            end: false,
            mermaid: "",
            parent: undefined,
            last_statement: undefined,
            last_condition: undefined,
            root: undefined,
            needs_end: undefined,
            try: false,
        };

        // Attach value for literals and identifiers
        node.value = code.slice(cursor.from, cursor.to);

        let edge_name = null;
        let is_parent = false;
        let new_point = false;

        nodes.push(node);
        node.parent = last_parent;
        from_id = get_last_statement(node);
        let needs_end = node.parent?.parent?.needs_end ||
            node.parent?.needs_end;
        if (def_parents.includes(node.parent.type)) needs_end = false;

        if (parent_types.includes(node.type)) {
            end_points[node.id] = [];
            is_parent = true;
            last_parent = node;
            console.log("new parent", node, node.parent);
        }

        if (cond_types.includes(node.type)) {
            if (node.parent.last_condition) {
                if (
                    !single_word_controls.includes(
                        nodes[node.parent.last_condition].type,
                    )
                ) {
                    edge_name = false;
                    add_edge(node.parent.last_condition, id, edge_name);
                    edge_name = null;
                }
            }
            node.parent.last_condition = id;
        }

        if (node.type == "try") {
            node.parent.try = [];
        }

        if (node.type == "except" && node.parent.try !== false) {
            let to_end = node.parent.try;
            console.log("catch excepts?", node);
            to_end.forEach((elem) => {
                add_edge(elem.id, id, elem.edge_name);
            });
            node.parent.try = false;
        }

        if (control_types.includes(node.type)) {
            new_point = true;
            node.parent.last_statement = id;
            node.parent.block_start = id;

            if (!node.parent.root) node.parent.root = id;

            if (
                node.parent.parent.unreachable_after &&
                node.parent.parent.unreachable_after < id
            ) {
                edge_name = `path unreachable`;
                node.parent.parent.unreachable_after = false;
            }

            if (node.parent.parent.block_start) {
                switch (nodes[node.parent.parent.block_start].type) {
                    case "def":
                        edge_name = "call";
                        break;
                    case "try":
                        edge_name = null;
                        break;
                    case "case":
                        edge_name = "matched";
                        break;
                    case "except":
                        edge_name = "exception matched";
                        break;
                    case "if":
                    case "elif":
                    case "while":
                        edge_name = true;
                        break;
                    case "for":
                        edge_name = "next item";
                        break;
                    default:
                        edge_name = null;
                }
                node.parent.parent.block_start = false;
            }

            if (
                from_id != false &&
                (!exclusives.includes(node.type) ||
                    nodes[from_id].type == "match") &&
                !def_types.includes(node.type)
            ) {
                add_edge(from_id, id, edge_name);
            }

            if (node.parent?.parent?.id && node.type == "def") {
                add_edge(node.parent.parent.root, id, edge_name);
            }

            node.mermaid = `${node.id}\{"${node.value}"\}`;
        }

        node.value = node.value
            .replace(/"/g, "#quot;")
            .replace(/_/g, "\\_");

        if (
            !single_word_controls.includes(node.type) &&
            control_types.includes(node.type)
        ) {
            node.begin = node.from;
            do {
                if (
                    cursor.type.name === "Body" ||
                    (node.type == "match" && cursor.type.name === "MatchBody")
                ) {
                    node.end = cursor.from;
                    node.value = code.slice(node.begin, node.end);
                    node.begin = false;
                    node.end = true;
                    cursor.prevSibling();
                    break;
                }
            } while (cursor.nextSibling());

            node.value = node.value
                .replace(/"/g, "#quot;")
                .replace(/_/g, "\\_");
            node.mermaid = `${node.id}\{"${node.value}"\}`;
        }

        let loop = get_parent(node, loop_parents);
        let defn = get_parent(node, def_parents);

        if (continues.includes(node.type)) {
            if (loop) {
                node.parent.unreachable_after = node.id;
                add_edge(
                    id,
                    loop.last_condition,
                    `continue ${nodes[loop.last_condition].value}`,
                );
            } else {
                if (defn) {
                    node.parent.unreachable_after = node.id;
                    add_edge(id, defn.root, `return value to caller`);
                }
            }
        }

        if (breaks.includes(node.type)) {
            loop = get_parent(node, loop_parents);
            if (loop) {
                node.parent.unreachable_after = node.id;
                add_end(loop.id, { id: id, edge_name: `exit ${loop.type}` });
            }
        }

        if (node.type.indexOf("Statement") > -1 && !is_parent) {
            new_point = true;
            node.parent.last_statement = id;

            if (
                node.parent.unreachable_after &&
                node.parent.unreachable_after < id
            ) {
                edge_name = `path unreachable`;
                node.parent.unreachable_after = false;
            }

            if (node.parent.block_start) {
                switch (nodes[node.parent.block_start].type) {
                    case "def":
                        edge_name = "call";
                        break;
                    case "try":
                        edge_name = null;
                        break;
                    case "case":
                        edge_name = "matched";
                        break;
                    case "except":
                        edge_name = "exception matched";
                        break;
                    case "if":
                    case "elif":
                    case "while":
                        edge_name = true;
                        break;
                    case "for":
                        edge_name = "next item";
                        break;
                    default:
                        edge_name = null;
                }
                node.parent.block_start = false;
            }

            if (from_id != false && !needs_end) {
                add_edge(from_id, id, edge_name);
            }
            node.begin = cursor.from;

            node.mermaid = `${node.id}\["${node.value}"\]`;
        }

        if (def_parents.includes(node.parent.type)) {
            new_point = false;
        }

        if (new_point && !single_word_controls.includes(node.type)) {
            if (node.parent.try !== false) {
                node.parent.try.push({ id: id, edge_name: `raised exception` });
            }
        }

        if (new_point && needs_end) {
            let to_end = end_points[needs_end.id];
            console.log("end inside?", end_points, { ...needs_end });
            to_end.forEach((elem) => {
                add_edge(elem.id, id, elem.edge_name);
            });
            needs_end.parent.needs_end = undefined;
        }

        if (cursor.firstChild()) {
            node.children = [];
            do {
                node.children.push(walk());
            } while (cursor.nextSibling());

            if (node.type === "Body") {
                if (node.parent.id && node.parent.type != "WhileStatement") {
                    add_end(node.parent.id, {
                        id: from_id,
                        edge_name: `exit ${node.parent.type}`,
                    });
                }
                if (loop_parents.includes(node.parent.type)) {
                    add_edge(
                        from_id,
                        node.parent.last_condition,
                        `continue ${nodes[node.parent.last_condition].value}`,
                    );
                }
            }

            if (node.type != "Script" && parent_types.includes(node.type)) {
                if (cond_parents.includes(node.type)) {
                    let fail_name = false;
                    let fail = true;
                    switch (node.type) {
                        case "TryStatement":
                            fail_name = `uncaught exception`;
                            break;
                        case "WhileStatement":
                            if (nodes[node.last_condition].type == "else") {
                                fail = false;
                            }
                            break;
                        case "ForStatement":
                            fail_name = "out of items";
                            break;
                        case "MatchStatement":
                            fail_name = `no match`;
                            break;
                    }
                    if (fail && node.last_condition) {
                        add_end(node.id, {
                            id: node.last_condition,
                            edge_name: fail_name,
                        });
                    }
                }
                if (from_id && node.type != "WhileStatement") {
                    add_end(node.id, {
                        id: from_id,
                        edge_name: `exit ${node.type}`,
                    });
                }
                last_parent = node.parent;
                if (!def_parents.includes(node.type)) {
                    node.parent.needs_end = node;
                }
            }

            cursor.parent();
        }

        return node;
    }

    let result = walk();
    let true_nodes = {};
    let e = Object.values(edges);

    e.forEach(function (elem, i) {
        if (!true_nodes[elem.from.id]) {
            true_nodes[elem.from.id] = elem.from;
        }
        if (!true_nodes[elem.to.id]) {
            true_nodes[elem.to.id] = elem.to;
        }
        let edge_name = elem.name != null ? `|"${elem.name}"|` : "";
        if (edge_name.indexOf("unreachable") > -1) {
            elem.mermaid = `${elem.from.id} --x${edge_name} ${elem.to.id}`;
            elem.style = `linkStyle ${i} stroke:red,stroke-dasharray:5 5;`;
        } else if (
            edge_name.indexOf("return") == 2 ||
            edge_name.indexOf("continue") == 2 ||
            edge_name.indexOf("exit") == 2
        ) {
            elem.mermaid = `${elem.from.id} -->${edge_name} ${elem.to.id}`;
            elem.style = `linkStyle ${i} stroke-dasharray:5 5;`;
        } else {
            elem.mermaid = `${elem.from.id} -->${edge_name} ${elem.to.id}`;
        }
    });

    return [result, true_nodes, e, nodes];
}

export function convertPythonToMermaid(code) {
    const tree = parser.parse(code);

    const annotatedTree = annotateTree(tree, code);
    const nodes = annotatedTree[1];
    const edges = annotatedTree[2];
    let out = ["flowchart TD"];
    Object.values(nodes).forEach((elem) => out.push(elem.mermaid));
    edges.forEach((elem) =>
        out.push(elem.mermaid) && elem.style && out.push(elem.style)
    );
    return { tree: annotateTree, value: out.join("\n") };
}
