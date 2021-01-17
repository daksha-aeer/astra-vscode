import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import fetch from 'cross-fetch';
import { TreeProvider, AstraTreeItem } from './TreeProvider';
import { Database, TableDocuments } from './types';
import {
  createCollection,
  createDocument,
  getDatabaseAuthToken,
  getDatabases,
  getDevOpsToken,
  getDocumentsInTable,
  getSecureBundleUrl,
  getTableSchemas,
  parkDatabase,
  runCql,
  terminateDatabase,
  unparkDatabase,
} from './api';
import DocumentProvider from './DocumentProvider';

const readFile = util.promisify(fs.readFile);

export async function activate(context: vscode.ExtensionContext) {
  let devOpsToken: string | undefined;
  const authTokens: { [databaseId: string]: string } = {};
  let connectedKeyspaces: string[] = [];

  // Provider object to populate tree view
  const treeProvider = new TreeProvider();
  vscode.window.registerTreeDataProvider(
    'databases-view',
    treeProvider,
  );

  // Provider object to view read-only virtual documents
  const documentProvider = new DocumentProvider();
  const documentsScheme = 'documents-scheme';
  vscode.workspace.registerTextDocumentContentProvider(
    documentsScheme,
    documentProvider,
  );

  // View JSON document in new window
  vscode.commands.registerCommand('astra-vscode.viewDocument',
    async (documentName: string, documentBody: Object) => {
      console.log('Opening document', documentName);
      console.log('Document body', documentBody);
      const formattedBody = JSON.stringify(documentBody, null, 2);
      const uri = vscode.Uri.parse(`${documentsScheme}:${documentName}.json?body=${formattedBody}`);
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Two });
      } catch (error) {
        console.error('Failed to open document', error);
      }
    });

  // Accept service account credentials from user
  vscode.commands.registerCommand('astra-vscode.setServiceCredentials',
    async () => {
      console.log('Setting service credentials');
      const sampleCredentials = {
        clientId: 'your-id', clientName: 'user@domain.com', clientSecret: 'secret',
      };
      const userInput = await vscode.window.showInputBox({
        prompt: 'Paste the credentials in the above format.',
        placeHolder: JSON.stringify(sampleCredentials),
      });
      await context.globalState.update('serviceCredentials', userInput);

      await vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
    });

  // Generate DevOps token using service credentials
  vscode.commands.registerCommand('astra-vscode.refreshDevOpsToken',
    async () => {
      console.log('Refreshing token');
      const serviceCredentials = context.globalState.get<string>('serviceCredentials');
      console.log('Retrieved credentials', serviceCredentials);
      try {
        const devOpsTokenResponse = await getDevOpsToken(serviceCredentials!);
        devOpsToken = devOpsTokenResponse.token;
      } catch (error) {
        console.error(error);
      }
    });

  // Get database list with DevOps API and update tree
  vscode.commands.registerCommand('astra-vscode.refreshUserDatabases',
    async () => {
      console.log('Token for fetching databases', devOpsToken);
      const databases = await getDatabases(devOpsToken!);
      console.log('Fetched databases', databases);

      if (Array.isArray(databases)) {
        treeProvider.refresh(databases);
      } else {
        console.log('No databases, create one');
      }
    });

  // Open link in web browser: for Studio, Grafana and secure bundle
  vscode.commands.registerCommand('astra-vscode.openUrlInBrowser',
    (url: string) => {
      console.log('Got URL', url);
      vscode.env.openExternal(vscode.Uri.parse(url));
    });

  // Open GraphQL playground for a database, within VSCode using webview
  vscode.commands.registerCommand('astra-vscode.openGraphQLInWebview',
    async (url: string) => {
      const panel = vscode.window.createWebviewPanel(
        'graphQLPlayground',
        'GraphQL Playground',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      // Display local HTML file containing the GraphQL URL
      const filePath = path.join(
        context.extensionPath, 'src', 'webviews', 'graphql-playground.html',
      );
      const fileContents = await readFile(filePath);
      const html = fileContents.toString().replace('{{url}}', url);
      panel.webview.html = html;
    });

  // Open Swagger UI for a database, within VSCode using webview
  vscode.commands.registerCommand('astra-vscode.openSwaggerInWebview',
    async (swaggerJsonUrl: string) => {
      const panel = vscode.window.createWebviewPanel(
        'swagger',
        'Swagger UI',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      // Display local HTML file using swagger.json file for the database
      const filePath = path.join(
        context.extensionPath, 'src', 'webviews', 'swagger-ui.html',
      );
      const fileContents = await readFile(filePath);
      const html = fileContents.toString().replace('{{url}}', swaggerJsonUrl);
      panel.webview.html = html;
    });

  // Input database password to additional database options
  vscode.commands.registerCommand('astra-vscode.connectToDatabase',
    async (databaseTreeItem: AstraTreeItem) => {
      console.log('got parm', databaseTreeItem);
      const database = databaseTreeItem.database!;
      console.log('got database', database);
      const { id } = database;
      try {
        let password = context.globalState.get<string>(`passwords.${id}`);
        let savePassword = false;
        console.log('Retrieved password', password);

        if (!password) {
          savePassword = true;
          password = await vscode.window.showInputBox({
            prompt: 'Database password',
          });
          console.log('input password', password);
        }
        const authTokenResponse = await getDatabaseAuthToken(database, password!);

        const { authToken } = authTokenResponse;
        console.log('Got auth token', authToken);
        if (authToken === undefined) {
          // Remove saved password if invalid
          vscode.window.showErrorMessage('Invalid password, try again!');
          context.globalState.update(`passwords.${id}`, undefined);
        } else {
          if (savePassword) {
            await context.globalState.update(`passwords.${id}`, password);
          }
          authTokens[id] = authToken!;
          treeProvider.displayConnectedDatabaseOptions(databaseTreeItem);
        }
      } catch (error) {
        vscode.window.showErrorMessage('Failed to connect');
      }
    });

  // Copy database auth token to clipboard
  vscode.commands.registerCommand('astra-vscode.copyDatabaseAuthToken',
    async (id: string) => {
      console.log('saved tokens', authTokens);
      await vscode.env.clipboard.writeText(authTokens[id]!);
      vscode.window.showInformationMessage('Token copied to clipboard');
    });

  // Open secure bundle download link in external browser
  vscode.commands.registerCommand('astra-vscode.downloadSecureConnectBundle',
    async (id: string) => {
      try {
        const response = await getSecureBundleUrl(id, devOpsToken!);
        await vscode.commands.executeCommand('astra-vscode.openUrlInBrowser', response.downloadURL);
      } catch (error) {
        vscode.window.showErrorMessage('Failed to get bundle link');
      }
    });

  // Display CQL shell for the database using VSCode integrated terminal
  vscode.commands.registerCommand('astra-vscode.openCqlsh',
    async (database: Database) => {
      console.log('Running shell');
      const bundlePath = await getBundlePath(database);
      console.log('Got bundle path', bundlePath);
      if (bundlePath) {
        // Run cqlsh

        const password = context.globalState.get<string>(`passwords.${database.id}`)!;
        const shell = vscode.window.createTerminal('CQL shell');
        shell.sendText(`cqlsh -u ${database.info.user} -p ${password} -b "${bundlePath}"`);
        shell.show();
      } else {
        console.log('No bundle to launch shell');
      }
    });

  // Fetch and display table schemas and documents
  vscode.commands.registerCommand('astra-vscode.getTablesAndDocsInKeyspace',
    async (keyspaceItem: AstraTreeItem) => {
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
          `${database.graphqlUrl}-schema`,
          keyspace,
          databaseToken,
        );

        console.log('Got tables', tableResponse);
        const tables = tableResponse.data?.keyspace.tables;

        const documentsPerTable: TableDocuments = {};
        const pageStatePerTable: { [tableName: string]: string | undefined } = {};
        let pageState: string | undefined;
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
                databaseToken,
              );
              console.log('Got documents', documentResponse);
              pageState = documentResponse.pageState;
              console.log('Got pageState', pageState);
              documentsPerTable[table.name] = documentResponse?.data;
              pageStatePerTable[table.name] = pageState;
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
        treeProvider.displayTablesAndDocsForKeyspace(
          keyspaceItem, documentsPerTable, pageStatePerTable, tables,
        );
      } catch (error) {
        console.error('Failed to get tables', error);
      }
    });

  /**
   * Documents API
   */

  // Load and display upto 5 more documents
  vscode.commands.registerCommand('astra-vscode.paginateDocuments',
    async (documentsGroupItem: AstraTreeItem, pageState: string) => {
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
          pageState,
        );
        console.log('Got documents', documentResponse);
        const newPageState = documentResponse.pageState;
        console.log('Got new page State', newPageState);

        treeProvider.displayPaginatedDocuments(documentsGroupItem, documentResponse);
      } catch (error) {
        console.error('Failed to paginate', error);
      }
    });

  // Input filter condition from user and search for documents in the collection
  vscode.commands.registerCommand('astra-vscode.searchDocuments',
    async (documentsGroupItem: AstraTreeItem) => {
      console.log('Searching documents for', documentsGroupItem);
      const database = documentsGroupItem.database!;
      const databaseToken = authTokens[database.id]!;

      const query = await vscode.window.showInputBox({
        prompt: 'Enter search query with operations $eq, $ne, $in, $nin, $gt, $lt, $gte, $lte or $exists.',
        placeHolder: JSON.stringify({ car: { $eq: 'ferrari' } }),
      });

      const documentResponse = await getDocumentsInTable(
        database.dataEndpointUrl,
        documentsGroupItem.keyspace!,
        documentsGroupItem.tableName!,
        databaseToken,
        undefined,
        query,
      );
      console.log('Got search response', documentResponse.data);
      await vscode.commands.executeCommand(
        'astra-vscode.viewDocument',
        'search-results',
        documentResponse.data,
      );
    });

  // Create collection using documents API
  vscode.commands.registerCommand('astra-vscode.createCollection',
    async (keyspaceItem: AstraTreeItem) => {
      const database = keyspaceItem.database!;
      const keyspace = keyspaceItem.keyspace!;
      const databaseToken = authTokens[database.id];
      console.log('Adding new collection to', keyspace);

      const collectionName = await vscode.window.showInputBox({
        prompt: 'Collection name',
      });

      if (collectionName) {
        try {
          const newCollectionResponse = await createCollection(
            database.dataEndpointUrl, keyspace, collectionName, databaseToken,
          );
          console.log('Collection creation response', newCollectionResponse.body);
          if (newCollectionResponse.status === 201) {
            vscode.window.showInformationMessage('Collection created');
            return await refreshTreeItems();
          }
          vscode.window.showErrorMessage('Failed to create');
        } catch (error) {
          vscode.window.showErrorMessage('Failed to create');
        }
      } else {
        vscode.window.showErrorMessage('No name provided');
      }
    });

  // Add new document to a collection
  vscode.commands.registerCommand('astra-vscode.createDocument',
    async (documentsGroupItem: AstraTreeItem) => {
      const database = documentsGroupItem.database!;
      const keyspace = documentsGroupItem.keyspace!;
      const tableName = documentsGroupItem.tableName!;
      const databaseToken = authTokens[database.id];

      const documentBody = await vscode.window.showInputBox({
        prompt: 'Document body',
        placeHolder: '{"name": "jack"}',
      });

      if (documentBody) {
        try {
          const newDocumentResponse = await createDocument(
            database.dataEndpointUrl, keyspace, tableName, databaseToken, documentBody,
          );
          console.log('Document creation response', newDocumentResponse.body);
          if (newDocumentResponse.status === 201) {
            vscode.window.showInformationMessage('Collection created');
            return await refreshTreeItems();
          }
          vscode.window.showErrorMessage('Failed to create');
        } catch (error) {
          vscode.window.showErrorMessage('Failed to create');
        }
      } else {
        vscode.window.showErrorMessage('No document body provided provided');
      }
    });

  /**
   * DevOps actions
   */

  // Park an active database
  vscode.commands.registerCommand('astra-vscode.parkDatabase',
    async (databaseItem: AstraTreeItem) => {
      const database = databaseItem.database!;
      console.log('Parking database', database);

      try {
        const parkResponse = await parkDatabase(database.id, devOpsToken!);
        console.log('Parking response', parkResponse);
        setTimeout(refreshTreeItems, 10000);
      } catch (error) {
        console.log('Failed to park', error);
      }
    });

  // Unpark a database
  vscode.commands.registerCommand('astra-vscode.unparkDatabase',
    async (databaseItem: AstraTreeItem) => {
      const database = databaseItem.database!;
      console.log('Unparking database', database);

      try {
        const unparkResponse = await unparkDatabase(database.id, devOpsToken!);
        console.log('Unpark response', unparkResponse);
        setTimeout(refreshTreeItems, 10000);
      } catch (error) {
        console.log('Failed to unpark', error);
      }
    });

  // Terminate database
  vscode.commands.registerCommand('astra-vscode.terminateDatabase',
    async (databaseItem: AstraTreeItem) => {
      const database = databaseItem.database!;
      console.log('Terminating database', database);

      try {
        const terminateResponse = await terminateDatabase(database.id, devOpsToken!);
        console.log('Termination response', terminateResponse);
        setTimeout(refreshTreeItems, 10000);
      } catch (error) {
        console.log('Failed to terminate', error);
      }
    });

  // Execute CQL commands from a .cql file, using secure bundle and Node.js driver
  vscode.commands.registerCommand('astra-vscode.runPlayground',
    async () => {
      const editor = vscode.window.activeTextEditor;
      const query = editor?.document.getText();
      console.log('Got text', query);

      const connectedDbNames: string[] = [];
      const connectedDbs: { [databaseName: string]: Database } = {};
      if (query) {
        // Select connected DB
        if (treeProvider.data && treeProvider.data.length > 0) {
          for (const databaseItem of treeProvider.data) {
            const databaseName = databaseItem.label as string;
            connectedDbNames.push(databaseName);
            connectedDbs[databaseName] = databaseItem.database!;
          }
          const dbName = await vscode.window.showQuickPick(connectedDbNames);
          if (dbName) {
            const selectedDb = connectedDbs[dbName];
            const userName = selectedDb.info.user;
            const dbId = selectedDb.id;
            let noPassword = false;
            let password = context.globalState.get<string>(`passwords.${dbId}`);

            // Check if password saved, else ask user for password
            if (!password) {
              noPassword = true;
              const passwordInput = await vscode.window.showInputBox({
                prompt: 'Database password',
              });
              if (passwordInput) {
                password = passwordInput;
                await context.globalState.update(`passwords.${dbId}`, password);
              } else {
                return vscode.window.showErrorMessage('No password provided');
              }
            }
            console.log('Selected db password', password);

            const bundlePath = await getBundlePath(selectedDb);
            if (bundlePath) {
              console.log('Found bundle path');
              // Run query and get result
              const response = await runCql(userName, password, bundlePath, query);

              // Format response
              const respData = response.rows.map((row) => {
                const rowData: { [key: string]: string | number } = {};
                for (const rowItemKey in row) {
                  let rowItem = row[rowItemKey];
                  if (typeof rowItem === 'object') {
                    rowItem = JSON.stringify(rowItem);
                  }
                  rowData[rowItemKey] = rowItem;
                }
                return rowData;
              });

              // Display results in webview
              const panel = vscode.window.createWebviewPanel(
                'cqlResponse',
                'CQL response',
                vscode.ViewColumn.Two,
                {
                  enableScripts: true,
                  retainContextWhenHidden: true,
                },
              );
              const filePath = path.join(
                context.extensionPath, 'src', 'webviews', 'cql-response.html',
              );
              const fileContents = await readFile(filePath);
              const html = fileContents.toString();
              panel.webview.html = html;
              await panel.webview.postMessage(respData);
            }
          }
        } else {
          vscode.window.showErrorMessage('Please connect to a database');
        }
      }
    });

  // Save secure bundle on device and return its path
  async function getBundlePath(database: Database) {
    const bundleName = `secure-bundle-${database.info.name}.zip`;
    const storageLocation = context.globalStorageUri;
    const bundleLocation = storageLocation.with({
      path: path.posix.join(storageLocation.path, bundleName),
    });
    console.log('Searching bundle in', bundleLocation);
    let bundlePresent = false;
    try {
      const bundles = await vscode.workspace.fs.readDirectory(storageLocation);
      console.log('Got bundles in directory', bundles);
      for (const [name, type] of bundles) {
        if (name === bundleName && type === vscode.FileType.File) {
          bundlePresent = true;
        }
      }
      console.log('Bundle found', bundlePresent);
    } catch (error) {
      console.error(error);
    }

    if (bundlePresent) {
      return bundleLocation.path;
    }
    // Download bundle if it does not present
    console.log('Bundle not saved, downloading');
    try {
      const bundleResponse = await getSecureBundleUrl(database.id, devOpsToken!);
      const secureBundleURL = bundleResponse.downloadURL;
      const response = await fetch(secureBundleURL);
      const buffer = Buffer.from(await response.arrayBuffer());
      await vscode.workspace.fs.writeFile(bundleLocation, buffer);
      return bundleLocation.path;
    } catch (error) {
      console.log('Bundle download failed');
      return undefined;
    }
  }

  // Re-fetch databases and refresh the tree
  async function refreshTreeItems() {
    if (devOpsToken) {
      await vscode.commands.executeCommand('astra-vscode.refreshUserDatabases');

      // Refresh connected databases and keyspaces
      for (const databaseItem of treeProvider?.data ?? []) {
        const databaseId = databaseItem.database!.id;
        // Reconnect if token exists
        if (databaseId in authTokens) {
          treeProvider.displayConnectedDatabaseOptions(databaseItem);

          const keyspaceGroupItem = databaseItem.children![2];

          const connectedKeyspaceNames = [...connectedKeyspaces];
          connectedKeyspaces = [];

          for (const keyspaceItem of keyspaceGroupItem.children ?? []) {
            if (connectedKeyspaceNames.includes(keyspaceItem!.label as string)) {
              keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
              await vscode.commands.executeCommand(
                'astra-vscode.getTablesAndDocsInKeyspace', keyspaceItem,
              );
            }
          }
        }
      }
    }
  }

  // Cron job to refresh databases
  const REFRESH_INTERVAL = 25 * 1000; // 30 seconds
  // setInterval(async () => {
  //   console.log('Cron job running');
  //   await refreshTreeItems();
  // }, REFRESH_INTERVAL);

  // Refresh token and fetch databases when extension is started
  await vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
  await vscode.commands.executeCommand('astra-vscode.refreshUserDatabases');
}

export function deactivate() { }
