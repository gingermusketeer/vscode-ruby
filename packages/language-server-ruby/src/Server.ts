import {
	ConfigurationItem,
	Connection,
	InitializeParams,
	InitializeResult,
} from 'vscode-languageserver';

import { CapabilityCalculator } from './CapabilityCalculator';
import DocumentHighlightProvider from './providers/DocumentHighlightProvider';
import FoldingRangeProvider from './providers/FoldingRangeProvider';
import ConfigurationProvider from './providers/ConfigurationProvider';
import WorkspaceProvider from './providers/WorkspaceProvider';
import DocumentSymbolProvider from './providers/DocumentSymbolProvider';

import { documents } from './DocumentManager';
import { LintResult, linter } from './Linter';

import { documentConfigurationCache, RubyConfiguration } from './SettingsCache';
import DocumentFormattingProvider from './providers/DocumentFormattingProvider';
import { forest } from './Forest';

export interface ILanguageServer {
	readonly capabilities: InitializeResult;
	registerInitializeProviders();
	registerInitializedProviders();
	shutdown();
}

export class Server implements ILanguageServer {
	public connection: Connection;
	private calculator: CapabilityCalculator;

	constructor(connection: Connection, params: InitializeParams) {
		this.connection = connection;
		this.calculator = new CapabilityCalculator(params.capabilities);

		documents.listen(connection);

		linter.subscribe({
			next: (result: LintResult): void => {
				connection.sendDiagnostics({ uri: result.document.uri, diagnostics: result.diagnostics });
			},
		});

		documentConfigurationCache.fetcher = async (
			targets: string[]
		): Promise<RubyConfiguration[]> => {
			const items: ConfigurationItem[] = targets.map(t => {
				return {
					scopeUri: t,
					section: 'ruby',
				};
			});
			return this.connection.workspace.getConfiguration(items);
		};
	}

	get capabilities(): InitializeResult {
		return {
			capabilities: this.calculator.capabilities,
		};
	}

	// registers providers on the initialize step
	public registerInitializeProviders(): void {
		// Handles highlight requests
		DocumentHighlightProvider.register(this.connection);

		// Handles folding requests
		FoldingRangeProvider.register(this.connection);

		// Handles document symbol requests
		DocumentSymbolProvider.register(this.connection);

		// Handles document formatting requests
		DocumentFormattingProvider.register(this.connection);
	}

	// registers providers on the initialized step
	public registerInitializedProviders(): void {
		// Handles configuration changes
		ConfigurationProvider.register(this.connection);

		// Handle workspace changes
		WorkspaceProvider.register(this.connection);
	}

	public shutdown(): void {
		forest.release();
	}
}
