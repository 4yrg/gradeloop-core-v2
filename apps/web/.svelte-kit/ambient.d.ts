
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const GHOSTTY_BIN_DIR: string;
	export const COLORTERM: string;
	export const HYPRLAND_CMD: string;
	export const XDG_CONFIG_DIRS: string;
	export const XDG_SESSION_PATH: string;
	export const NVM_INC: string;
	export const XDG_MENU_PREFIX: string;
	export const TERM_PROGRAM_VERSION: string;
	export const GUM_CONFIRM_PROMPT_FOREGROUND: string;
	export const JOBS: string;
	export const XDG_BACKEND: string;
	export const NODE: string;
	export const XDG_DATA_HOME: string;
	export const GUM_CONFIRM_SELECTED_BACKGROUND: string;
	export const INPUT_METHOD: string;
	export const XCOMPOSEFILE: string;
	export const CLOJURE_HOME: string;
	export const XDG_CONFIG_HOME: string;
	export const OMARCHY_PATH: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const npm_config_local_prefix: string;
	export const XMODIFIERS: string;
	export const DESKTOP_SESSION: string;
	export const ELECTRON_OZONE_PLATFORM_HINT: string;
	export const HL_INITIAL_WORKSPACE_TOKEN: string;
	export const XCURSOR_SIZE: string;
	export const EDITOR: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const LOGNAME: string;
	export const XDG_SESSION_DESKTOP: string;
	export const XDG_SESSION_TYPE: string;
	export const BUN_WHICH_IGNORE_CWD: string;
	export const SYSTEMD_EXEC_PID: string;
	export const _: string;
	export const TERMINAL: string;
	export const QT_STYLE_OVERRIDE: string;
	export const MOTD_SHOWN: string;
	export const GHOSTTY_SHELL_FEATURES: string;
	export const HOME: string;
	export const LANG: string;
	export const _JAVA_AWT_WM_NONREPARENTING: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const npm_package_version: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const STARSHIP_SHELL: string;
	export const WAYLAND_DISPLAY: string;
	export const __MISE_DIFF: string;
	export const XDG_SEAT_PATH: string;
	export const MANAGERPID: string;
	export const BAT_THEME: string;
	export const INIT_CWD: string;
	export const STARSHIP_SESSION_KEY: string;
	export const QT_QPA_PLATFORM: string;
	export const UWSM_WAIT_VARNAMES: string;
	export const __MISE_ORIG_PATH: string;
	export const XDG_CACHE_HOME: string;
	export const npm_lifecycle_script: string;
	export const NVM_DIR: string;
	export const SDL_IM_MODULE: string;
	export const GHOSTTY_RESOURCES_DIR: string;
	export const XDG_SESSION_CLASS: string;
	export const TERM: string;
	export const TERMINFO: string;
	export const npm_package_name: string;
	export const USER: string;
	export const SDL_VIDEODRIVER: string;
	export const SUDO_EDITOR: string;
	export const OZONE_PLATFORM: string;
	export const __MISE_SESSION: string;
	export const HYPRLAND_INSTANCE_SIGNATURE: string;
	export const BUN_INTERNAL_BUNX_INSTALL: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const NVM_CD_FLAGS: string;
	export const MOZ_ENABLE_WAYLAND: string;
	export const QT_IM_MODULE: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const MANAGERPIDFDID: string;
	export const npm_config_user_agent: string;
	export const XDG_STATE_HOME: string;
	export const npm_execpath: string;
	export const XDG_RUNTIME_DIR: string;
	export const DEBUGINFOD_URLS: string;
	export const npm_package_json: string;
	export const BUN_INSTALL: string;
	export const MISE_SHELL: string;
	export const XDG_DATA_DIRS: string;
	export const GDK_BACKEND: string;
	export const PATH: string;
	export const GDK_SCALE: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const MAIL: string;
	export const NVM_BIN: string;
	export const GUM_CONFIRM_UNSELECTED_FOREGROUND: string;
	export const UWSM_FINALIZE_VARNAMES: string;
	export const GUM_CONFIRM_UNSELECTED_BACKGROUND: string;
	export const npm_node_execpath: string;
	export const OLDPWD: string;
	export const GUM_CONFIRM_SELECTED_FOREGROUND: string;
	export const HYPRCURSOR_SIZE: string;
	export const TERM_PROGRAM: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		GHOSTTY_BIN_DIR: string;
		COLORTERM: string;
		HYPRLAND_CMD: string;
		XDG_CONFIG_DIRS: string;
		XDG_SESSION_PATH: string;
		NVM_INC: string;
		XDG_MENU_PREFIX: string;
		TERM_PROGRAM_VERSION: string;
		GUM_CONFIRM_PROMPT_FOREGROUND: string;
		JOBS: string;
		XDG_BACKEND: string;
		NODE: string;
		XDG_DATA_HOME: string;
		GUM_CONFIRM_SELECTED_BACKGROUND: string;
		INPUT_METHOD: string;
		XCOMPOSEFILE: string;
		CLOJURE_HOME: string;
		XDG_CONFIG_HOME: string;
		OMARCHY_PATH: string;
		MEMORY_PRESSURE_WRITE: string;
		npm_config_local_prefix: string;
		XMODIFIERS: string;
		DESKTOP_SESSION: string;
		ELECTRON_OZONE_PLATFORM_HINT: string;
		HL_INITIAL_WORKSPACE_TOKEN: string;
		XCURSOR_SIZE: string;
		EDITOR: string;
		XDG_SEAT: string;
		PWD: string;
		LOGNAME: string;
		XDG_SESSION_DESKTOP: string;
		XDG_SESSION_TYPE: string;
		BUN_WHICH_IGNORE_CWD: string;
		SYSTEMD_EXEC_PID: string;
		_: string;
		TERMINAL: string;
		QT_STYLE_OVERRIDE: string;
		MOTD_SHOWN: string;
		GHOSTTY_SHELL_FEATURES: string;
		HOME: string;
		LANG: string;
		_JAVA_AWT_WM_NONREPARENTING: string;
		XDG_CURRENT_DESKTOP: string;
		npm_package_version: string;
		MEMORY_PRESSURE_WATCH: string;
		STARSHIP_SHELL: string;
		WAYLAND_DISPLAY: string;
		__MISE_DIFF: string;
		XDG_SEAT_PATH: string;
		MANAGERPID: string;
		BAT_THEME: string;
		INIT_CWD: string;
		STARSHIP_SESSION_KEY: string;
		QT_QPA_PLATFORM: string;
		UWSM_WAIT_VARNAMES: string;
		__MISE_ORIG_PATH: string;
		XDG_CACHE_HOME: string;
		npm_lifecycle_script: string;
		NVM_DIR: string;
		SDL_IM_MODULE: string;
		GHOSTTY_RESOURCES_DIR: string;
		XDG_SESSION_CLASS: string;
		TERM: string;
		TERMINFO: string;
		npm_package_name: string;
		USER: string;
		SDL_VIDEODRIVER: string;
		SUDO_EDITOR: string;
		OZONE_PLATFORM: string;
		__MISE_SESSION: string;
		HYPRLAND_INSTANCE_SIGNATURE: string;
		BUN_INTERNAL_BUNX_INSTALL: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		NVM_CD_FLAGS: string;
		MOZ_ENABLE_WAYLAND: string;
		QT_IM_MODULE: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		MANAGERPIDFDID: string;
		npm_config_user_agent: string;
		XDG_STATE_HOME: string;
		npm_execpath: string;
		XDG_RUNTIME_DIR: string;
		DEBUGINFOD_URLS: string;
		npm_package_json: string;
		BUN_INSTALL: string;
		MISE_SHELL: string;
		XDG_DATA_DIRS: string;
		GDK_BACKEND: string;
		PATH: string;
		GDK_SCALE: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		MAIL: string;
		NVM_BIN: string;
		GUM_CONFIRM_UNSELECTED_FOREGROUND: string;
		UWSM_FINALIZE_VARNAMES: string;
		GUM_CONFIRM_UNSELECTED_BACKGROUND: string;
		npm_node_execpath: string;
		OLDPWD: string;
		GUM_CONFIRM_SELECTED_FOREGROUND: string;
		HYPRCURSOR_SIZE: string;
		TERM_PROGRAM: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
