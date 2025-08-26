import { searchEmojis } from "./emojis";
import {
  SearchResult,
  couldBeMath,
  ls,
  searchClipboard,
  exec,
  hasUnterminatedBackslash,
} from "./appLauncherUtils";
import AstalApps from "gi://AstalApps";

function fuzzyMatch(text: string, pattern: string): boolean {
  let patternIdx = 0;
  let textIdx = 0;

  while (patternIdx < pattern.length && textIdx < text.length) {
    if (pattern[patternIdx] === text[textIdx]) {
      patternIdx++;
    }
    textIdx++;
  }

  return patternIdx === pattern.length;
}

export function enhancedSearch(
  query: string,
  cachedApps: AstalApps.Application[],
): SearchResult[] {
  const results: SearchResult[] = [];

  if (!query) {
    return cachedApps.slice(0, 5).map((app) => ({
      type: "app" as const,
      title: app.name,
      subtitle: app.description || "",
      icon: app.iconName || "application-x-executable",
      data: app,
    }));
  }

  const isAction = query.startsWith(">");
  const isDir = query.startsWith("/") || query.startsWith("~");
  const isAI = query.startsWith("ai:") || query.startsWith("ask:");
  const isClip = query.startsWith("c:");
  const isEmoji = query.startsWith("i:");

  if (couldBeMath(query)) {
    try {
      const mathExpression = query
        .replace(/\^/g, "**")
        .replace(/π/g, "Math.PI")
        .replace(/e/g, "Math.E");
      const result = new Function("return " + mathExpression)();
      results.push({
        type: "math",
        title: result.toString(),
        subtitle: "Click to copy result to clipboard",
        icon: "accessories-calculator",
        data: { result, expression: query },
      });
    } catch {
      // Math evaluation failed, ignore
    }
  }

  if (isDir) {
    // Extract directory path and search term from query
    const lastSlashIndex = query.lastIndexOf("/");
    const dirPath = query.substring(0, lastSlashIndex + 1) || "/";
    const searchTerm = query.substring(lastSlashIndex + 1).toLowerCase();

    const dirResults = ls({ path: dirPath, silent: true, limit: 50 });

    // Fuzzy filter results based on search term
    const filteredResults = dirResults.filter((item) => {
      if (!searchTerm) return true; // Show all if no search term
      const itemName = item.name.toLowerCase();
      return (
        itemName.includes(searchTerm) ||
        itemName.startsWith(searchTerm) ||
        fuzzyMatch(itemName, searchTerm)
      );
    });

    // Sort by relevance
    filteredResults.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      if (!searchTerm) return aName.localeCompare(bName);

      const aStartsWith = aName.startsWith(searchTerm);
      const bStartsWith = bName.startsWith(searchTerm);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      const aIncludes = aName.includes(searchTerm);
      const bIncludes = bName.includes(searchTerm);

      if (aIncludes && !bIncludes) return -1;
      if (!aIncludes && bIncludes) return 1;

      return aName.localeCompare(bName);
    });

    filteredResults.slice(0, 10).forEach((item) => {
      results.push({
        type: "directory",
        title: item.name,
        subtitle: item.parentPath,
        icon: item.icon,
        data: item,
      });
    });
  }

  if (isAI) {
    const aiQuery = query.replace(/^(ai:|ask:)\s*/, "");
    if (aiQuery.trim()) {
      results.push({
        type: "ai",
        title: "Ask AI",
        subtitle: `Search "${aiQuery}" with Perplexity AI`,
        icon: "preferences-system-search",
        data: { query: aiQuery },
      });
    }
  }

  if (isClip) {
    const clipQuery = query.replace(/^c:\s*/, "");
    if (clipQuery.trim().length > 1) {
      const clipboardResults = searchClipboard(clipQuery);
      results.push(...clipboardResults);
    } else {
      try {
        const clipboardResults = searchClipboard("");
        results.push(...clipboardResults.slice(0, 10));
      } catch (error) {
        console.error("Error loading clipboard items:", error);
      }
    }
  }

  if (isEmoji) {
    const emojiQuery = query.replace(/^i:\s*/, "");
    if (emojiQuery.trim().length > 0) {
      const emojiResults = searchEmojis(emojiQuery);
      emojiResults.slice(0, 8).forEach((emoji) => {
        results.push({
          type: "emoji",
          title: emoji.emoji,
          subtitle: `${emoji.name} - ${emoji.keywords.slice(0, 3).join(", ")}`,
          icon: "face-smile",
          data: { emoji: emoji.emoji, name: emoji.name },
        });
      });
    } else {
      const popularEmojis = searchEmojis("");
      popularEmojis.slice(0, 8).forEach((emoji) => {
        results.push({
          type: "emoji",
          title: emoji.emoji,
          subtitle: `${emoji.name} - ${emoji.keywords.slice(0, 3).join(", ")}`,
          icon: "face-smile",
          data: { emoji: emoji.emoji, name: emoji.name },
        });
      });
    }
  }

  if (isAction) {
    results.push({
      type: "action",
      title: "Action",
      subtitle: query,
      icon: "system-run",
      data: { command: query },
    });
  }

  if (!isAction && !hasUnterminatedBackslash(query)) {
    const firstWord = query.split(" ")[0];
    const commandExists =
      exec(`bash -c "command -v ${firstWord}"`).trim() !== "";
    if (commandExists) {
      results.push({
        type: "command",
        title: "Run Command",
        subtitle: query,
        icon: query.startsWith("sudo")
          ? "dialog-password"
          : "utilities-terminal",
        data: { command: query, terminal: query.startsWith("sudo") },
      });
    }
  }

  const q = query.toLowerCase();
  function score(app: AstalApps.Application) {
    try {
      const name = app.name?.toLowerCase() || "";
      const desc = app.description?.toLowerCase() || "";
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.includes(q)) return 2;
      if (desc.includes(q)) return 3;
      return 99;
    } catch (error) {
      console.error("Error scoring app:", error);
      return 99;
    }
  }

  try {
    const appResults = cachedApps
      .map((app) => ({ app, s: score(app) }))
      .filter(({ s }) => s < 99)
      .sort((a, b) => a.s - b.s)
      .slice(0, 5)
      .map(({ app }) => ({
        type: "app" as const,
        title: app.name,
        subtitle: app.description || "",
        icon: app.iconName || "application-x-executable",
        data: app,
      }));

    results.push(...appResults);
  } catch (error) {
    console.error("Error in app search:", error);
  }

  if (!isAction && !isDir && !isAI && !isClip && !isEmoji && query.length > 2) {
    const clipboardResults = searchClipboard(query);
    results.push(...clipboardResults);
  }

  if (
    !isAction &&
    !isDir &&
    !isAI &&
    !isClip &&
    !isEmoji &&
    results.length < 3
  ) {
    const isQuestion =
      /^(what|how|why|when|where|who|can|should|will|is|are|do|does|did|which)\s/i.test(
        query,
      ) ||
      query.includes("?") ||
      query.split(" ").length > 3;

    if (isQuestion) {
      results.push({
        type: "ai",
        title: "Ask AI",
        subtitle: `Ask "${query}" using Perplexity AI`,
        icon: "preferences-system-search",
        data: { query },
      });
    }

    results.push({
      type: "web",
      title: "Search the web",
      subtitle: query,
      icon: "web-browser",
      data: { query },
    });
  }

  return results;
}
