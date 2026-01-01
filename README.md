# Quartermaster Obsidian Plugin

Welcome to the official documentation for the Quartermaster plugin for Obsidian. This plugin is designed to help you manage the economy of your TTRPG campaigns directly within your Obsidian vault.

## Installation

As the plugin is currently in development, it is not yet available on the community plugin store. To install it manually, please follow these steps:

1.  **Build the Plugin:**
    *   Navigate to the `packages/obsidian-plugin` directory in your terminal.
    *   Run `npm install` to install the necessary dependencies.
    *   Run `npm run build` to compile the plugin. This will create a `dist` folder containing the plugin files.

2.  **Copy to Your Vault:**
    *   Open your Obsidian vault.
    *   Navigate to the `.obsidian/plugins/` directory.
    *   Create a new folder named `quartermaster`.
    *   Copy the `main.js`, `manifest.json`, and `styles.css` files from the `packages/obsidian-plugin/dist` folder into the newly created `quartermaster` folder.

3.  **Enable the Plugin:**
    *   In Obsidian, go to `Settings` > `Community Plugins`.
    *   If you have existing plugins, you may need to reload them.
    *   You should see "Quartermaster" in the list of installed plugins. Make sure the toggle switch is on to enable it.

## Features

The Quartermaster plugin provides a suite of tools to manage your campaign's economy, job market, and more. Most features are accessible through the Obsidian Command Palette (`Ctrl/Cmd + P`).

### Core Features

*   **Action Menu:** The central hub for the plugin. Access it via the quill icon in the ribbon or by running the command `Quartermaster: Open Action Menu`.
*   **Settings:** Configure all aspects of the plugin by navigating to `Settings` > `Community Plugins` > `Quartermaster`.

### Entity Management

*   **Party Members:** Manage your player characters and their stats with the `Quartermaster: Manage Party Members` command.
*   **Hirelings:** Recruit and manage non-player characters.
    *   `Quartermaster: Hire NPC`
    *   `Quartermaster: Manage Hirelings`
*   **Factions:** Create and manage factions within your world using `Quartermaster: Create Faction`.
*   **Locations:** Define new locations with `Quartermaster: Create Location`.

### Economic Systems

*   **Job Board:** A complete system for creating and managing jobs.
    *   `Quartermaster: Open Job Board`: View the main job board interface.
    *   `Quartermaster: Create New Job`: Add a new job listing.
    *   `Quartermaster: Export Player Job Board`: Generate a player-facing view of available jobs.
*   **Projects:** Manage long-term projects and their requirements.
    *   `Quartermaster: Project Browser`: View and manage ongoing projects.
    *   `Quartermaster: Create Project Template`: Create reusable project templates.
    *   `Quartermaster: Start New Project`: Begin a new project from a template or from scratch.
*   **Shop Interface:** A legacy command (`Quartermaster: Open Shop Interface`) provides access to a shop generation tool.

### Campaign & Time Management

*   **Activity Log:** View a log of all significant events and transactions with `Quartermaster: Open Activity Log`.
*   **Advance Time:** Move the in-game calendar forward using the `Quartermaster: Advance Time` command.

### Inventory Management

The plugin provides a system for tracking party inventory within a dedicated markdown file (by default `Party Inventory.md`). You can display and organize inventory using custom code blocks:

*   **Player Inventory:**
    ````markdown
    ```quartermaster-player
    id: <player_id>
    ```
    ````
*   **Shared Inventory:**
    ````markdown
    ```quartermaster-shared
    ```
    ````
*   **Containers:**
    ````markdown
    ```quartermaster-container
    name: Bag of Holding
    capacity: 500
    ```
    ````
