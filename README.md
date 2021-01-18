# VS Code Extension for DataStax Astra
We have built a VS Code extension which lets you manage and query Astra databases, directly from your IDE. The extension makes it easy to work with Astra by reducing context switching.

# Features
## Databases explorer

1. View database clusters, their status and region
2. Park/unpark/terminate databases
3. View keyspaces, tables, schemas and documents

**Explorer**

![1 explorer](https://user-images.githubusercontent.com/49580849/104845564-1dce6300-58fc-11eb-846e-1e79ece1ced2.png)

**Park or terminate**

![park and terminate](https://user-images.githubusercontent.com/49580849/104845448-97b21c80-58fb-11eb-9a0c-4e918acd50b0.png)

## Quick access to APIs and monitoring
1. Open GraphQL explorer and Swagger UI directly inside VS Code

    ![graphql](https://user-images.githubusercontent.com/49580849/104847311-53c41500-5905-11eb-9660-dea8c0b6faae.png)

    ![swagger](https://user-images.githubusercontent.com/49580849/104847315-57579c00-5905-11eb-8adc-173a84f225af.png)

2. Automatic refresh and copy button for database auth tokens

    ![copy-auth-token](https://user-images.githubusercontent.com/49580849/104847317-5888c900-5905-11eb-94d0-641156c00f81.gif)

3. Download secure bundle

    ![save-bundle](https://user-images.githubusercontent.com/49580849/104847318-5b83b980-5905-11eb-9c87-938b206a4e40.gif)

4. Launch Grafana

    ![grafana](https://user-images.githubusercontent.com/49580849/104847326-5de61380-5905-11eb-853a-5199f80328b8.gif)

5. Launch DataStax studio

    ![studio](https://user-images.githubusercontent.com/49580849/104847331-64748b00-5905-11eb-8c31-6a02c649905f.gif)

6. Open CQL shell inside VS Code integrated terminal

    ![cql-shell](https://user-images.githubusercontent.com/49580849/104848139-9d166380-5909-11eb-90b7-2e7583bcf8ba.png)

## Document API actions
Tables containing documents get a unique icon, along with actions to interact with documents. Besides schema, document list is also displayed for such tables.

![table-vs-collection](https://user-images.githubusercontent.com/49580849/104849934-7d376d80-5912-11eb-998b-2d72a5ace9b6.png)

1. Create collection

    ![new-collection](https://user-images.githubusercontent.com/49580849/104849721-444ac900-5911-11eb-9e43-713093041a47.gif)

2. Add document to a collection

    ![new-document](https://user-images.githubusercontent.com/49580849/104849839-eec2ec00-5911-11eb-9125-a85cbf2ec81b.gif)

3. View documents inside any collection, with pagination support

    ![view-and-paginate-docs](https://user-images.githubusercontent.com/49580849/104849479-e4075780-590f-11eb-989c-cb8d46a794c2.gif)

4. Search documents by running queries directly inside VS Code

    ![search-docs-small](https://user-images.githubusercontent.com/49580849/104849846-f5516380-5911-11eb-852e-c1831a1d3a42.gif)

## Execute `.cql` files directly inside VS Code

![run CQL](https://user-images.githubusercontent.com/49580849/104844695-b1e9fb80-58f7-11eb-8f4b-cedb3d64e18b.png)

![cql-result](https://user-images.githubusercontent.com/49580849/104848540-72c5a580-590b-11eb-8199-b3b82d8e9bb2.png)

# Astra APIs used
## DevOps APIs
1. [Generate DevOps token](https://docs.astra.datastax.com/reference#authenticateserviceaccounttoken-1): `https://api.astra.datastax.com/v2/authenticateServiceAccount`

2. [List databases](https://docs.astra.datastax.com/reference#listdatabases-1): `'https://api.astra.datastax.com/v2/databases?include=nonterminated&provider=ALL`

3. [Obtain secure bundle download URL](https://docs.astra.datastax.com/reference#generatesecurebundleurl-1): `https://api.astra.datastax.com/v2/databases/databaseID/secureBundleURL`

4. [Park database](https://docs.astra.datastax.com/reference#parkdatabase-1): `https://api.astra.datastax.com/v2/databases/databaseID/park`

5. [Unpark database](https://docs.astra.datastax.com/reference#unparkdatabase-1): `https://api.astra.datastax.com/v2/databases/databaseID/unpark`

6. [Terminate database](https://docs.astra.datastax.com/reference#terminatedatabase-1): `https://api.astra.datastax.com/v2/databases/databaseID/terminate`

## Document API
1. [Generate auth token](https://docs.astra.datastax.com/reference#post_api-rest-v1-auth-1): `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v1/auth`

2. [Search documents in collection](https://docs.astra.datastax.com/reference#get_api-rest-v2-namespaces-namespace-id-collections-collection-id-1):  `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v2/namespaces/namespace-id/collections/collection-id`

3. [Create collection](https://docs.astra.datastax.com/reference#post_api-rest-v2-schemas-namespaces-namespace-id-collections-1): `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v2/schemas/namespaces/namespace-id/collections`

4. [Create document](https://docs.astra.datastax.com/reference#post_api-rest-v2-namespaces-namespace-id-collections-collection-id-1): `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v2/namespaces/namespace-id/collections/collection-id`

## GraphQL API
To fetch list of tables in a keyspace, along with table schemas.
```graphql
query getTableSchema($keyspace: String!) {
    keyspace(name: $keyspace) {
        tables {
            name
            columns {
                kind
                name
                type {
                    basic
                }
            }
        }
    }
}
```

## [Node.js driver](https://docs.astra.datastax.com/docs/connecting-to-your-database-with-the-datastax-nodejs-driver)
To run `.cql` files against user's tables.

## [Standalone cqlsh shell](https://docs.astra.datastax.com/docs/connecting-to-astra-databases-using-cqlsh)
For running cqlsh directly from VS Code's integrated terminal.

# Future scope
1. Improve security and publish to extension marketplace.
2. The extension uses polling to get updated data from Astra. Polling can be replaced with more efficient events, once this feature is implemented in Stargate.
3. Functionality to run DataStax studio notebooks directly inside VS Code.

# Setup instructions

## General setup
1. Create a service account from the Astra console. Copy the credentials.

![service account](https://user-images.githubusercontent.com/49580849/104844686-ad254780-58f7-11eb-924b-78cc3c8354bc.png)


2.  Open the repository using VS Code. Press F5 button to view the extension in debug mode ([instructions](https://code.visualstudio.com/api/get-started/your-first-extension)). Alternatively to run the production build, install the extension using the `astra-vscode-0.0.1.vsix` file and [instructions on this page](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix).
3. Press the **Connect Astra** button and enter your service credentials. Database list and available actions will be displayed.

![add service credentials](https://user-images.githubusercontent.com/49580849/104844687-af87a180-58f7-11eb-881e-22ab940016b9.png)

4. Hover your mouse near a database item to make the connect button visible. Press the button and enter your database password. Keyspace names, copy auth token button and CQL shell buttons will get displayed.

![connect db](https://user-images.githubusercontent.com/49580849/104844689-b0b8ce80-58f7-11eb-9e9d-d4fc35f6138f.png)

5. Connect keyspaces: Hover near a keyspace item to make the connect button visible. Press it and tables, schemas and documents will get displayed.

![connect keyspace](https://user-images.githubusercontent.com/49580849/104844692-b0b8ce80-58f7-11eb-9222-7dc7f1d9d74a.png)


## Document API actions
There are separate icons for regular tables and collection tables. Collection tables also have a documents section.

1. Add collection button

    ![Create collection](https://user-images.githubusercontent.com/49580849/104844987-1b1e3e80-58f9-11eb-836d-91c04dc8b35f.png)

2. Buttons to search and add documents are next to the documents item.
3. Add more than 5 documents to the collection so that **load more** pagination button is displayed.

![document API options](https://user-images.githubusercontent.com/49580849/104844694-b1516500-58f7-11eb-83c1-1b4e7e68df4d.png)

## DevOps actions
Create new databases from the Astra console to view different status colors:

1. Green: Active
2. Red: Terminating
3. Yellow: Parked, and other states

![Status](https://user-images.githubusercontent.com/49580849/104844988-1ce80200-58f9-11eb-88ef-3748efd563b4.png)

Available actions are displayed by right clicking any database item.

1. Park: For active databases
2. Unpark: For parked databases
3. Terminate: For active and parked

![park and terminate](https://user-images.githubusercontent.com/49580849/104845448-97b21c80-58fb-11eb-9a0c-4e918acd50b0.png)

## Run CQL files
1. [Install VS Code CQL extension](https://marketplace.visualstudio.com/items?itemName=LawrenceGrant.cql). It is needed to recognize `.cql` files. VS Code does not natively detect CQL files.
2. Open any `.cql` file. Press the run button on top. Select the database to run against. The query results will be displayed.

![run CQL](https://user-images.githubusercontent.com/49580849/104844695-b1e9fb80-58f7-11eb-8f4b-cedb3d64e18b.png)

## CQL shell
Ensure that `cqlsh` for DataStax Astra is installed ([install link](https://downloads.datastax.com/#cqlsh)) and available in `$path`.
