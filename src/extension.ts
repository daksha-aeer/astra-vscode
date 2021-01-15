import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import fetch from 'cross-fetch';
import { Provider, AstraTreeItem } from './Provider';
import { Database, TableDocuments } from './types';
import {
	createCollection,
	getDatabaseAuthToken,
	getDatabases,
	getDevOpsToken,
	getDocumentsInTable,
	getSecureBundleUrl,
	getTableSchemas,
	parkDatabase,
	terminateDatabase,
	unparkDatabase
} from './api';
import DocumentProvider from './DocumentProvider';
const readFile = util.promisify(fs.readFile);

export async function activate(context: vscode.ExtensionContext) {
	let devOpsToken: string | undefined = undefined;
	let authTokens: { [databaseId: string]: string } = {};
	let connectedKeyspaces: string[] = [];
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
			const devOpsTokenResponse = await getDevOpsToken(serviceCredentials!);
			devOpsToken = devOpsTokenResponse.token;
		} catch (error) {
			console.error(error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.refreshUserDatabases', async () => {
		console.log('Token for fetching databases', devOpsToken);
		const databases = await getDatabases(devOpsToken!);
		console.log('Fetched databases', databases);

		if (Array.isArray(databases)) {
			provider.refresh(databases);
		} else {
			console.log('No databases, create one');
		}

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
				retainContextWhenHidden: true,
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
				retainContextWhenHidden: true,
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
			const response = await getSecureBundleUrl(id, devOpsToken!);
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
			const bundleResponse = await getSecureBundleUrl(database.id, devOpsToken!);
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

	vscode.commands.registerCommand('astra-vscode.getTablesAndDocsInKeyspace', async (keyspaceItem: AstraTreeItem) => {
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
			// Get schema
			const tableResponse = await getTableSchemas(
				database.graphqlUrl + '-schema',
				keyspace,
				databaseToken
			);

			console.log('Got tables', tableResponse);
			const tables = tableResponse.data?.keyspace.tables;

			let documentsPerTable: TableDocuments = {};
			let pageState: string | undefined = undefined;
			// TODO when no tables
			if (tables && Array.isArray(tables) && tables.length > 0) {

				for (const table of tables) {
					try {
						// Get documents
						console.log('Getting documents for table', table.name);
						const documentResponse = await getDocumentsInTable(
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


			} else {
				console.log('No tables in keyspace');
			}
			connectedKeyspaces.push(keyspace);
			provider.displayTablesAndDocsForKeyspace(keyspaceItem, documentsPerTable, tables, pageState);

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
			const documentResponse = await getDocumentsInTable(
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

		const documentResponse = await getDocumentsInTable(
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

	vscode.commands.registerCommand('astra-vscode.parkDatabase', async (databaseItem: AstraTreeItem) => {
		const database = databaseItem.database!;
		console.log('Parking database', database);

		try {
			const parkResponse = await parkDatabase(database.id, devOpsToken!);
			console.log('Parking response', parkResponse);
			setTimeout(refreshItems, 10000);
		} catch (error) {
			console.log('Failed to park', error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.terminateDatabase', async (databaseItem: AstraTreeItem) => {
		const database = databaseItem.database!;
		console.log('Terminating database', database);

		try {
			const terminateResponse = await terminateDatabase(database.id, devOpsToken!);
			console.log('Termination response', terminateResponse);
			setTimeout(refreshItems, 10000);
		} catch (error) {
			console.log('Failed to terminate', error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.unparkDatabase', async (databaseItem: AstraTreeItem) => {
		const database = databaseItem.database!;
		console.log('Unparking database', database);

		try {
			const unparkResponse = await unparkDatabase(database.id, devOpsToken!);
			console.log('Unpark response', unparkResponse);
			setTimeout(refreshItems, 10000);
		} catch (error) {
			console.log('Failed to unpark', error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.createCollection', async (keyspaceItem: AstraTreeItem) => {
		const database = keyspaceItem.database!;
		const keyspace = keyspaceItem.keyspace!;
		const databaseToken = authTokens[database.id];
		console.log('Adding new collection to', keyspace);

		const collectionName = await vscode.window.showInputBox({
			prompt: 'Collection name',
		})

		if (collectionName) {
			try {
				const newCollectionResponse = await createCollection(
					database.dataEndpointUrl, keyspace, collectionName, databaseToken
				);
				console.log('Collection creation response', newCollectionResponse.body);
				if (newCollectionResponse.status === 201) {
					vscode.window.showInformationMessage('Collection created');
					return await refreshItems();
				} else {
					vscode.window.showErrorMessage('Failed to create');
				}
			} catch (error) {
				vscode.window.showErrorMessage('Failed to create');
			}
		} else {
			vscode.window.showErrorMessage('No name provided');
		}
	})

	async function refreshItems() {
		if (devOpsToken) {
			await vscode.commands.executeCommand('astra-vscode.refreshUserDatabases');

			// Refresh connected databases and keyspaces
			for (const databaseItem of provider?.data ?? []) {
				const databaseId = databaseItem.database!.id;
				// Reconnect if token exists
				if (databaseId in authTokens) {
					provider.displayConnectedDatabaseOptions(databaseItem);

					const keyspaceGroupItem = databaseItem.children![2];

					const connectedKeyspaceNames = [...connectedKeyspaces];
					connectedKeyspaces = [];
					for (const keyspaceItem of keyspaceGroupItem.children ?? []) {
						if (connectedKeyspaceNames.includes(keyspaceItem!.label as string)) {
							keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
							await vscode.commands.executeCommand('astra-vscode.getTablesAndDocsInKeyspace', keyspaceItem);
						}
					}
				}
			}
		}
	}

	// Cron job to refresh databases
	const REFRESH_INTERVAL = 25 * 1000; // 30 seconds
	setInterval(async () => {
		console.log("Cron job running");
		await refreshItems();
	}, REFRESH_INTERVAL);

	await vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
	await vscode.commands.executeCommand('astra-vscode.refreshUserDatabases');
}

export function deactivate() { }
