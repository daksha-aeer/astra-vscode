import * as vscode from 'vscode';
import { NodeDependenciesProvider } from './Provider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Starting Astra extension');

	const provider = new NodeDependenciesProvider(vscode.workspace.rootPath);
	vscode.window.registerTreeDataProvider(
		'astra-explorer',
		provider
	);

	vscode.commands.registerCommand('astra-vscode.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Astra VSCode!');
	});

	vscode.commands.registerCommand('astra-vscode.readServiceCredentials', async () => {
		console.log('Reading service credentials')
		const sampleCredentials = { clientId: "your-id", clientName: "user@domain.com", clientSecret: "secret" }
		const userInput = await vscode.window.showInputBox({
			prompt: 'Paste the credentials in the above format.',
			placeHolder: JSON.stringify(sampleCredentials),
		})
		try {
			const serviceCredentials: typeof sampleCredentials = JSON.parse(userInput!);
			console.log('Got', serviceCredentials);
		} catch (error) {
			vscode.window.showErrorMessage('Invalid credentials!')
		}
	});

	vscode.commands.registerCommand('astra-vscode.refreshEntry', () => {
		provider.refresh();
	});
}

export function deactivate() { }
