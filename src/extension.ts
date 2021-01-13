import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import fetch from 'cross-fetch';
import { Provider, AstraTreeItem } from './Provider';
import { BundleResponse, Database, Documents, TableDocuments } from './types';
import { getDatabaseAuthToken, getDocuments, getSecureBundle, getTablesInKeyspace } from './api';
import DocumentProvider from './DocumentProvider';
const readFile = util.promisify(fs.readFile);

export async function activate(context: vscode.ExtensionContext) {
	let devOpsToken: string | null = null;
	let authTokens: { [key: string]: string | undefined } = {};
	const sampleCredentials = { clientId: "your-id", clientName: "user@domain.com", clientSecret: "secret" }
	console.log('Starting Astra extension');

	const provider = new Provider();
	vscode.window.registerTreeDataProvider(
		'databases-view',
		provider
	);

	// To view virtual documents
	const documentProvider = new DocumentProvider();
	const documentsScheme = 'documents-scheme';
	vscode.workspace.registerTextDocumentContentProvider(documentsScheme, documentProvider);

	vscode.commands.registerCommand('astra-vscode.viewDocument', async (documentName: string, documentBody: any) => {
		console.log('Opening document', documentName);
		console.log('Document body', documentBody);
		const uri = vscode.Uri.parse(`${documentsScheme}:${documentName}.json?body=${documentBody}`);
		try {
			const doc = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Two });
		} catch (error) {
			console.error('Failed to open document', error);
		}

	});

	vscode.commands.registerCommand('astra-vscode.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Astra VSCode!');
	});

	vscode.commands.registerCommand('astra-vscode.setServiceCredentials', async () => {
		console.log('Setting service credentials')

		const userInput = await vscode.window.showInputBox({
			prompt: 'Paste the credentials in the above format.',
			placeHolder: JSON.stringify(sampleCredentials),
		})
		await context.globalState.update('serviceCredentials', userInput);

		await vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
	});

	vscode.commands.registerCommand('astra-vscode.refreshDevOpsToken', async () => {
		console.log('Refreshing token');
		const serviceCredentials = context.globalState.get<string>('serviceCredentials');
		console.log('Retrieved credentials', serviceCredentials);
		try {
			const result = await fetch('https://api.astra.datastax.com/v2/authenticateServiceAccount', {
				method: 'POST',
				body: serviceCredentials,
			}).then(res => res.json());

			if (result.token === null) {
				throw 'Failed to get token';
			} else {
				vscode.window.showInformationMessage('Token refreshed');
				devOpsToken = result.token;
				console.log('Got devOps token', devOpsToken);
			}
		} catch (error) {
			console.error(error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.refreshUserDatabases', async () => {
		console.log('Token for fetching databases', devOpsToken);

		const databases: [Database] = await fetch('https://api.astra.datastax.com/v2/databases?include=nonterminated', {
			headers: {
				Authorization: "Bearer " + devOpsToken,
			}
		}).then(res => res.json());
		console.log('Fetched databases', databases);

		provider.refresh(databases);
		vscode.window.showInformationMessage('Token refreshed');
	})

	vscode.commands.registerCommand('astra-vscode.openUrlInBrowser', (url: string) => {
		console.log('Got URL', url);
		vscode.env.openExternal(vscode.Uri.parse(url));
	});

	vscode.commands.registerCommand('astra-vscode.openGraphQLInWebview', async (url: string) => {
		const panel = vscode.window.createWebviewPanel(
			'graphQLPlayground',
			'GraphQL Playground',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
			}
		);

		const filePath = path.join(context.extensionPath, 'src', 'webviews', 'graphql-playground.html');
		const fileContents = await readFile(filePath);
		const html = fileContents.toString().replace('{{url}}', url);
		panel.webview.html = html;
	});

	vscode.commands.registerCommand('astra-vscode.openSwaggerInWebview', async (url: string) => {
		const panel = vscode.window.createWebviewPanel(
			'swagger',
			'Swagger UI',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
			}
		);

		const filePath = path.join(context.extensionPath, 'src', 'webviews', 'swagger-ui.html');
		const fileContents = await readFile(filePath);
		const html = fileContents.toString().replace('{{url}}', url);
		panel.webview.html = html;
	});

	vscode.commands.registerCommand('astra-vscode.connectToDatabase', async (databaseTreeItem: AstraTreeItem) => {
		console.log('got parm', databaseTreeItem);
		const database = databaseTreeItem.database!;
		console.log('got database', database);
		const id = database.id;
		try {
			let password = context.globalState.get<string>(`passwords.${id}`);
			let savePassword = false;
			console.log('Retrieved password', password);

			if (!password) {
				savePassword = true;
				password = await vscode.window.showInputBox({
					prompt: 'Database password',
				})
				console.log('input password', password);
			}
			const authTokenResponse = await getDatabaseAuthToken(database, password!);

			const authToken: string | null = authTokenResponse.authToken;
			console.log('Got auth token', authToken);
			if (authToken === undefined) {
				vscode.window.showErrorMessage('Invalid password, try again!');
				context.globalState.update(`passwords.${id}`, undefined); // remove saved password
			} else {
				if (savePassword) {
					await context.globalState.update(`passwords.${id}`, password);
				}
				authTokens[id] = authToken!;
				provider.displayConnectedDatabaseOptions(databaseTreeItem);
			}

		} catch (error) {
			vscode.window.showErrorMessage('Failed to connect');
		}
	})

	vscode.commands.registerCommand('astra-vscode.copyDatabaseAuthToken', async (id: string) => {
		console.log('saved tokens', authTokens);
		await vscode.env.clipboard.writeText(authTokens[id]!);
		vscode.window.showInformationMessage('Token copied to clipboard');
	});

	vscode.commands.registerCommand('astra-vscode.downloadSecureConnectBundle', async (id: string) => {
		try {
			const response = await getSecureBundle(id, devOpsToken!);
			await vscode.commands.executeCommand('astra-vscode.openUrlInBrowser', response.downloadURL);
		} catch (error) {
			vscode.window.showErrorMessage('Failed to get bundle link');
		}
	});

	vscode.commands.registerCommand('astra-vscode.openCqlsh', async (database: Database) => {
		const bundleName = `secure-bundle-${database.info.name}.zip`;
		const bundleLocation = context.globalStorageUri.with({
			path: path.posix.join(context.globalStorageUri.path, bundleName)
		});

		const bundles = await vscode.workspace.fs.readDirectory(context.globalStorageUri);
		console.log('Read bundles', bundles.toString());

		let bundlePresent = false;
		for (const [name, type] of bundles) {
			if (name === bundleName && type === vscode.FileType.File) {
				bundlePresent = true;
			}
		}
		console.log('Bundle found', bundlePresent);

		// Download bundle if not present
		if (!bundlePresent) {
			const bundleResponse = await getSecureBundle(database.id, devOpsToken!);
			const secureBundleURL = bundleResponse.downloadURL;
			const response = await fetch(secureBundleURL);
			const buffer = Buffer.from(await response.arrayBuffer());
			await vscode.workspace.fs.writeFile(bundleLocation, buffer);
		}

		// Run cqlsh
		const password = context.globalState.get<string>(`passwords.${database.id}`)!;
		const shell = vscode.window.createTerminal('CQL shell');
		shell.sendText(`cqlsh -u ${database.info.user} -p ${password} -b "${bundleLocation.path}"`);
		shell.show();
	});

	vscode.commands.registerCommand('astra-vscode.getTablesInKeyspace', async (keyspaceItem: AstraTreeItem) => {
		const database = keyspaceItem.database!;
		const keyspace = keyspaceItem.keyspace!;
		console.log('Getting tables for keyspace', keyspace);
		const databaseToken = authTokens[database.id];
		console.log('Got database token', databaseToken);
		if (databaseToken === undefined) {
			console.log('No database token, connecting to DB');
			return vscode.window.showInformationMessage('Connect to database to explore keyspaces');
		}
		try {
			const tableResponse = await getTablesInKeyspace(
				`${database.graphqlUrl}-schema`, keyspace, authTokens[database.id]!
			);
			console.log('Got tables', tableResponse);
			const tables: { name: string }[] | undefined = tableResponse.data.keyspace.tables;

			let pageState: string | undefined = undefined;
			if (tables) {
				// Get documents
				let documentsPerTable: TableDocuments = {};
				for (const table of tables) {
					try {
						console.log('Getting documents for table', table.name);
						const documentResponse = await getDocuments(
							database.dataEndpointUrl,
							keyspace,
							table.name,
							databaseToken
						);
						console.log('Got documents', documentResponse);
						pageState = documentResponse.pageState;
						console.log('Got pageState', pageState);
						documentsPerTable[table.name] = documentResponse?.data;
					} catch (error) {
						console.log('No documents for this table');
					}
				}

				// pass document
				console.log('Got all documents', documentsPerTable);
				provider.displayTablesAndDocsForKeyspace(keyspaceItem, tables, documentsPerTable, pageState);

			} else {
				console.log('No tables in keyspace');
			}

		} catch (error) {
			console.error('Failed to get tables', error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.paginateDocuments', async (
		documentsGroupItem: AstraTreeItem, pageState: string
	) => {
		const database = documentsGroupItem.database!;
		const keyspace = documentsGroupItem.keyspace!;
		const tableName = documentsGroupItem.tableName!;
		console.log('Getting documents for table', tableName);
		const databaseToken = authTokens[database.id];
		console.log('Got database token', databaseToken);
		if (databaseToken === undefined) {
			console.log('No database token, connecting to DB');
			return vscode.window.showInformationMessage('Connect to database to explore keyspaces');
		}
		try {
			const documentResponse = await getDocuments(
				database.dataEndpointUrl,
				keyspace,
				tableName,
				databaseToken,
				pageState
			);
			console.log('Got documents', documentResponse);
			const newPageState = documentResponse.pageState;
			console.log('Got new page State', newPageState);

			provider.displayPaginatedDocuments(documentsGroupItem, documentResponse);
		} catch (error) {
			console.error('Failed to paginate', error);
		}

	})

	vscode.commands.registerCommand('astra-vscode.searchDocuments', async (documentsGroupItem: AstraTreeItem) => {
		console.log('Searching documents for', documentsGroupItem);
		const database = documentsGroupItem.database!;
		const databaseToken = authTokens[database.id]!;

		const query = await vscode.window.showInputBox({
			prompt: 'Enter search query with operations $eq, $ne, $in, $nin, $gt, $lt, $gte, $lte or $exists.',
			placeHolder: JSON.stringify({ "car": { "$eq": "ferrari" } }),
		})

		const documentResponse = await getDocuments(
			database.dataEndpointUrl,
			documentsGroupItem.keyspace!,
			documentsGroupItem.tableName!,
			databaseToken,
			undefined,
			query
		);
		console.log('Got search response', documentResponse.data);
		await vscode.commands.executeCommand(
			'astra-vscode.viewDocument',
			'search-results',
			JSON.stringify(documentResponse.data)
		);
	})
	await vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
	await vscode.commands.executeCommand('astra-vscode.refreshUserDatabases');
}

export function deactivate() { }
