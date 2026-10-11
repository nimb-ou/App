# Baton bundle format, version 1

The canonical representation is UTF-8 JSON. The ZIP is a portable transport envelope; a bundle may also be kept as a directory.

## Layout

```text
HANDOFF.md
conversation.md
loss-audit.md
bundle.json
manifest.json
source/<original-name>
recovered/<safe-relative-path>   # optional
```

## `bundle.json`

- `format`: the literal `baton.bundle`
- `version`: semantic format version (`1.0.0`)
- `title`, `createdAt`, `importedAt`
- `source`: kind, original name, optional locator, and retained source path
- `sourceMeta`: source identifiers, model label, visible/branch node counts, or source links where available
- `messages[]`: ordered visible messages with source IDs, role, timestamp, typed content blocks, and field provenance
- `recoveredFiles[]`: safe relative path, text content, source message ID, recovery status, and caveat
- `lossAudit[]`: severity, count, title, and evidence-based explanation

Message block types in v1 are `text`, `code`, `tool_call`, `tool_result`, `reasoning_summary`, and `attachment`. Unknown source content should be kept in the original file even when a parser cannot normalize it.

## Integrity

`manifest.json` contains SHA-256 hashes for every other generated file and the retained source. The manifest does not hash itself. Consumers must treat it as an integrity check, not as a signature.

## Safety rules

Importers must retain the raw source, never execute recovered code, reject archive paths containing `..`, and distinguish a missing result from a result that says "none." A loss finding records what can be inferred from the source; it is not a claim that omitted data never existed.
