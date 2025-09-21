# AGENTS.md - d7shell Development Guide

## Build/Lint/Test Commands

- `bun run dev` - Development mode with hot reload using entr
- `bun run run` - Run the shell (`ags run app.ts --gtk 4`)
- `bun run lint` - ESLint check (`.ts`, `.js` files)
- `bun run format` - Format code with Prettier
- `bun run check-format` - Check formatting without changes

## Code Style Guidelines

- **Language**: TypeScript with strict mode enabled
- **Framework**: Astal/GTK4 with JSX (`jsxImportSource: "astal/gtk4"`)
- **Imports**: Use relative imports for local files, absolute for libraries
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Components**: Export default function components, use JSX.Element return type
- **Error Handling**: Use try-catch blocks, log errors with `console.error`
- **Variables**: Use Astal's `Variable()` for reactive state
- **Formatting**: Prettier with default settings
- **Linting**: ESLint with TypeScript recommended rules, unused vars as warnings
- **Comments**: Use JSDoc style for util functions documentation and never add unnessary comments.

## Project Structure

- `lib/` - Core utilities and services
- `widget/` - UI components organized by feature
- `style/` - SCSS stylesheets
- `option.ts` - Configuration file
- `app.ts` - Main entry point

## Astal/GTK4 Framework Patterns

### JSX Component Structure

```tsx
export default function ComponentName() {
  return (
    <box vertical spacing={6}>
      <label useMarkup label="<b>Title</b>" />
      {/* Children */}
    </box>
  );
}
```

### Reactive Data Binding

```tsx
// Bind to reactive properties
{
  bind(audio, "speakers").as((speakers) =>
    speakers.map((speaker) => (
      <button onClicked={() => speaker.set_is_default(true)}>
        {/* Button content */}
      </button>
    )),
  );
}
```

### Window Management

- Windows are managed through `App.get_window(name)`
- Use `PopupWindow` component for modal dialogs
- Windows can be shown/hidden with `.show()` and `.hide()`
- Avoid destroying windows if reuse is needed for performance

## AstalWp (WirePlumber) Audio API

### Available Collections

- `audio.speakers` - Output devices with `isDefault`, `set_is_default()`, `volumeIcon`, `description`
- `audio.microphones` - Input devices with same API as speakers
- `audio.recorders` - Lower-level streams (different API)

### Default Device Access

- `wp.defaultMicrophone` / `wp.default_microphone` - Default input device
- `wp.defaultSpeaker` / `wp.default_speaker` - Default output device
- Note: Inconsistent naming between camelCase and snake_case in the API

### Device Properties

- `device.isDefault` - Boolean indicating if device is currently default
- `device.set_is_default(true)` - Method to set device as default
- `device.volumeIcon` - Icon name for volume level
- `device.description` - Human-readable device name
- `device.mute` / `device.set_mute(boolean)` - Mute state and control

## Performance Optimization Patterns

### Caching Strategies

```tsx
// Use Map for persistent caching across component lifecycles
let cache: Map<string, CacheType> = new Map();

// Check cache before expensive operations
let cachedData = cache.get(key);
if (!cachedData) {
  cachedData = expensiveOperation();
  cache.set(key, cachedData);
}
```

### Background Processing

```tsx
// Show cached content immediately, process new content in background
if (cachedItems.length > 0) {
  showItems(cachedItems);
}

// Process missing items asynchronously
Promise.all(missingItems.map(processItem)).then(() => {
  showAllItems(allItems);
});
```

### Window Persistence

```tsx
// Prevent window destruction to maintain cache
hook(self, App, "window-toggled", (_, win) => {
  if (win.name === "window-name" && !win.visible) {
    self.hide(); // Don't destroy, just hide
  }
});
```

## Common UI Patterns

### Device Selectors

- Use `bind()` for reactive device lists
- Show active device with "active" CSS class
- Provide click handlers to set default devices
- Include device icons and descriptions with text truncation

### Button Structure

```tsx
<button
  cssClasses={bind(device, "isDefault").as((isDefault) => {
    const classes = ["button"];
    isDefault && classes.push("active");
    return classes;
  })}
  onClicked={() => device.set_is_default(true)}
>
  <box>
    <image iconName={device.volumeIcon} />
    <label
      label={device.description}
      ellipsize={Pango.EllipsizeMode.END}
      maxWidthChars={30}
    />
  </box>
</button>
```

### File Operations

- Use `GLib.file_test()` to check file existence
- Use `Gio.File.new_for_path()` for file operations
- Use `ensureDirectory()` utility before writing files
- Handle image formats with `GdkPixbuf.Pixbuf` for thumbnails

## TypeScript Considerations

### Type Definition Issues

- The codebase has widespread TypeScript type definition issues
- JSX component props may show type errors but work at runtime
- Focus on runtime functionality over TypeScript compliance
- Similar patterns exist in working components (e.g., WifiPage.tsx)

### Binding Types

- `bind()` returns `Binding<T>` which may show type conflicts with Widget expectations
- These are generally safe to ignore if following established patterns
- The framework handles binding resolution at runtime

## Development Workflow

### Making Changes

1. Always run `bun run lint` after changes to catch obvious issues
2. Use `bun run dev` for hot reload during development
3. Test functionality rather than relying solely on TypeScript errors
4. Follow existing patterns from similar components

### Performance Testing

- Monitor component render times, especially for large lists
- Use browser dev tools for memory usage analysis
- Test with realistic data sizes (hundreds of wallpapers, multiple audio devices)
- Implement progressive loading for large datasets
