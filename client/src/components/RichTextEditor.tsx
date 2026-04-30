import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { BulletList } from "@tiptap/extension-bullet-list";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  ListChecks,
  Minus,
  Indent,
  Outdent,
  RemoveFormatting,
  Type,
  ChevronDown,
  MoreHorizontal,
  X,
} from "lucide-react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: Record<string, any>) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

const ExtendedBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("class"),
        renderHTML: (attrs: Record<string, any>) =>
          attrs.class ? { class: attrs.class } : {},
      },
    };
  },
});

const FONTS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Lora", value: "Lora, serif" },
  { label: "JetBrains Mono", value: '"JetBrains Mono", monospace' },
  { label: "Caveat", value: "Caveat, cursive" },
  { label: "Bebas Neue", value: '"Bebas Neue", sans-serif' },
];

const FONT_SIZES = [
  { label: "Small", value: "0.875rem" },
  { label: "Medium", value: "1rem" },
  { label: "Large", value: "1.25rem" },
];

const HIGHLIGHT_COLORS = [
  { label: "Yellow", color: "#FFFF66" },
  { label: "Green", color: "#99FF99" },
  { label: "Pink", color: "#FF99CC" },
  { label: "Orange", color: "#FFB347" },
  { label: "Blue", color: "#99CCFF" },
  { label: "Purple", color: "#D6A6FF" },
];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing…",
  minHeight = "240px",
}: RichTextEditorProps) {
  const [showHighlight, setShowHighlight] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const highlightRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false }),
      ExtendedBulletList,
      Underline,
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        "data-placeholder": placeholder,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [editor, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        highlightRef.current &&
        !highlightRef.current.contains(e.target as Node)
      ) {
        setShowHighlight(false);
      }
      if (
        overflowRef.current &&
        !overflowRef.current.contains(e.target as Node)
      ) {
        setShowOverflow(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!editor) return null;

  const currentFont = editor.getAttributes("textStyle").fontFamily || "";
  const currentSize = editor.getAttributes("textStyle").fontSize || "1rem";
  const isInDashList = editor.isActive("bulletList", { class: "dash-list" });

  const toggleDashList = () => {
    if (isInDashList) {
      editor.chain().focus().toggleBulletList().run();
    } else if (editor.isActive("bulletList")) {
      editor
        .chain()
        .focus()
        .updateAttributes("bulletList", { class: "dash-list" })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .toggleBulletList()
        .updateAttributes("bulletList", { class: "dash-list" })
        .run();
    }
  };

  const indent = () => {
    const ok = editor.chain().focus().sinkListItem("listItem").run();
    if (!ok) editor.chain().focus().sinkListItem("taskItem").run();
  };

  const outdent = () => {
    const ok = editor.chain().focus().liftListItem("listItem").run();
    if (!ok) editor.chain().focus().liftListItem("taskItem").run();
  };

  const tbBtn = (
    onClick: () => void,
    icon: React.ReactNode,
    title: string,
    active = false,
    extraClass = ""
  ) => (
    <button
      key={title}
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors flex-shrink-0 ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${extraClass}`}
    >
      {icon}
    </button>
  );

  const fontFamilySelect = (
    <div className="relative flex items-center flex-shrink-0">
      <Type className="absolute left-1.5 h-3 w-3 text-muted-foreground pointer-events-none z-10" />
      <select
        value={currentFont}
        onChange={(e) => {
          if (e.target.value) {
            editor.chain().focus().setFontFamily(e.target.value).run();
          } else {
            editor.chain().focus().unsetFontFamily().run();
          }
        }}
        className="pl-6 pr-5 py-0.5 text-xs border border-border rounded bg-background cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-primary w-[104px]"
        title="Font family"
      >
        <option value="">Default</option>
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1 h-3 w-3 text-muted-foreground pointer-events-none" />
    </div>
  );

  const fontSizeSelect = (
    <div className="relative flex items-center flex-shrink-0">
      <select
        value={currentSize}
        onChange={(e) => {
          if (e.target.value === "1rem") {
            editor.chain().focus().unsetFontSize().run();
          } else {
            editor.chain().focus().setFontSize(e.target.value).run();
          }
        }}
        className="pl-2 pr-5 py-0.5 text-xs border border-border rounded bg-background cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-primary w-[72px]"
        title="Font size"
      >
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1 h-3 w-3 text-muted-foreground pointer-events-none" />
    </div>
  );

  const sep = <span className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />;

  const highlightPopover = (
    <div className="relative flex-shrink-0" ref={highlightRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setShowHighlight((v) => !v);
        }}
        title="Highlight"
        className={`p-1.5 rounded transition-colors ${
          editor.isActive("highlight")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Highlighter className="h-3.5 w-3.5" />
      </button>
      {showHighlight && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-1.5 flex-wrap w-[120px]">
          {HIGHLIGHT_COLORS.map(({ label, color }) => (
            <button
              key={color}
              type="button"
              title={label}
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().setHighlight({ color }).run();
                setShowHighlight(false);
              }}
              className="h-6 w-6 rounded-full border border-border/50 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
          <button
            type="button"
            title="Remove highlight"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().unsetHighlight().run();
              setShowHighlight(false);
            }}
            className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );

  const overflowMenu = (
    <div className="md:hidden relative flex-shrink-0" ref={overflowRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setShowOverflow((v) => !v);
        }}
        className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="More"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {showOverflow && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-3 min-w-[200px]">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Font
            </p>
            <div className="flex flex-col gap-1.5">
              {fontFamilySelect}
              {fontSizeSelect}
            </div>
          </div>
          <div className="border-t border-border pt-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              More tools
            </p>
            <div className="flex flex-wrap gap-0.5">
              {tbBtn(
                () => editor.chain().focus().toggleStrike().run(),
                <Strikethrough className="h-3.5 w-3.5" />,
                "Strikethrough",
                editor.isActive("strike")
              )}
              {tbBtn(
                toggleDashList,
                <Minus className="h-3.5 w-3.5" />,
                "Dash list",
                isInDashList
              )}
              {tbBtn(indent, <Indent className="h-3.5 w-3.5" />, "Indent")}
              {tbBtn(outdent, <Outdent className="h-3.5 w-3.5" />, "Outdent")}
              {tbBtn(
                () =>
                  editor.chain().focus().unsetAllMarks().clearNodes().run(),
                <RemoveFormatting className="h-3.5 w-3.5" />,
                "Clear formatting"
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .rte-wrap .ProseMirror {
          min-height: ${minHeight};
          padding: 0.75rem;
          outline: none;
        }
        .rte-wrap .ProseMirror.is-editor-empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          float: left;
          height: 0;
        }
        .rte-wrap .ProseMirror ul.dash-list {
          list-style: none;
          padding-left: 1.25rem;
        }
        .rte-wrap .ProseMirror ul.dash-list > li::before {
          content: '– ';
          margin-left: -1rem;
        }
        .rte-wrap .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0.25rem;
        }
        .rte-wrap .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }
        .rte-wrap .ProseMirror ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          margin-top: 0.15rem;
        }
        .rte-wrap .ProseMirror blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1rem;
          color: #6b7280;
          font-style: italic;
          margin: 0.5rem 0;
        }
        .rte-wrap .ProseMirror code {
          background: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: monospace;
        }
        .rte-wrap .ProseMirror pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          font-family: monospace;
          font-size: 0.875em;
          margin: 0.5rem 0;
        }
        .rte-wrap .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .rte-wrap .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0 0.375rem; }
        .rte-wrap .ProseMirror h3 { font-size: 1.125rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .rte-wrap .ProseMirror ul, .rte-wrap .ProseMirror ol { padding-left: 1.5rem; margin: 0.25rem 0; }
        .rte-wrap .ProseMirror li { margin: 0.125rem 0; }
        .rte-wrap .ProseMirror p { margin: 0.25rem 0; }
        .rte-wrap .ProseMirror p:first-child { margin-top: 0; }
        .rte-wrap .ProseMirror mark { border-radius: 0.125rem; padding: 0 0.125rem; }
      `}</style>

      <div className="rte-wrap border border-border rounded-lg overflow-hidden bg-background">
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto">
            <span className="hidden md:flex items-center gap-0.5">
              {fontFamilySelect}
              {fontSizeSelect}
              {sep}
            </span>

            {tbBtn(
              () => editor.chain().focus().toggleBold().run(),
              <Bold className="h-3.5 w-3.5" />,
              "Bold",
              editor.isActive("bold")
            )}
            {tbBtn(
              () => editor.chain().focus().toggleItalic().run(),
              <Italic className="h-3.5 w-3.5" />,
              "Italic",
              editor.isActive("italic")
            )}
            {tbBtn(
              () => editor.chain().focus().toggleUnderline().run(),
              <UnderlineIcon className="h-3.5 w-3.5" />,
              "Underline",
              editor.isActive("underline")
            )}
            {tbBtn(
              () => editor.chain().focus().toggleStrike().run(),
              <Strikethrough className="h-3.5 w-3.5" />,
              "Strikethrough",
              editor.isActive("strike"),
              "hidden md:flex"
            )}

            {sep}
            {highlightPopover}
            {sep}

            {tbBtn(
              () => editor.chain().focus().toggleBulletList().run(),
              <List className="h-3.5 w-3.5" />,
              "Bullet list",
              editor.isActive("bulletList") && !isInDashList
            )}
            {tbBtn(
              toggleDashList,
              <Minus className="h-3.5 w-3.5" />,
              "Dash list",
              isInDashList,
              "hidden md:flex"
            )}
            {tbBtn(
              () => editor.chain().focus().toggleOrderedList().run(),
              <ListOrdered className="h-3.5 w-3.5" />,
              "Numbered list",
              editor.isActive("orderedList")
            )}
            {tbBtn(
              () => editor.chain().focus().toggleTaskList().run(),
              <ListChecks className="h-3.5 w-3.5" />,
              "Checklist",
              editor.isActive("taskList")
            )}

            <span className="hidden md:flex items-center gap-0.5">
              {sep}
              {tbBtn(indent, <Indent className="h-3.5 w-3.5" />, "Indent")}
              {tbBtn(outdent, <Outdent className="h-3.5 w-3.5" />, "Outdent")}
              {sep}
              {tbBtn(
                () =>
                  editor.chain().focus().unsetAllMarks().clearNodes().run(),
                <RemoveFormatting className="h-3.5 w-3.5" />,
                "Clear formatting"
              )}
            </span>

            <span className="flex-1" />
            {overflowMenu}
          </div>
        </div>

        <EditorContent editor={editor} />
      </div>
    </>
  );
}
