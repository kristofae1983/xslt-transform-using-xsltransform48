import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

interface XsltParameter {
    name: string;
    value: string;
}

interface ErrorDetails {
    type?: string;
    line?: number;
    position?: number;
    message?: string;
    file?: string;
    code?: number;  // Make code optional
}

const PARAMETER_CACHE_KEY = 'xsltTransformParams';

export function activate(context: vscode.ExtensionContext) {
    // Register command for transforming from XSLT file context
    context.subscriptions.push(vscode.commands.registerCommand('xslt-transform.transformFromXslt', async () => {
        const xsltEditor = vscode.window.activeTextEditor;
        if (!xsltEditor || !(xsltEditor.document.fileName.endsWith('.xsl') || xsltEditor.document.fileName.endsWith('.xslt'))) {
            vscode.window.showErrorMessage('Please open an XSLT file first');
            return;
        }

        const xsltPath = xsltEditor.document.uri.fsPath;
        const xsltContent = xsltEditor.document.getText();
        const definedParams = extractXsltParameters(xsltContent);

        const xmlUris = await vscode.window.showOpenDialog({
            filters: { 'XML Files': ['xml'] },
            title: 'Select XML Input File',
            defaultUri: vscode.Uri.file(path.dirname(xsltPath))
        });
        if (!xmlUris || xmlUris.length === 0) {
            return;
        }

        const xmlPath = xmlUris[0].fsPath;
        const outputPath = getOutputPath(xmlPath);
        const parameters = await collectDefinedParameters(context, definedParams);

        await executeTransform(context, xmlPath, xsltPath, outputPath, parameters, xsltEditor);
    }));

    // Register command for transforming from XML file context
    context.subscriptions.push(vscode.commands.registerCommand('xslt-transform.transform', async () => {
        const xmlEditor = vscode.window.activeTextEditor;
        if (!xmlEditor || !xmlEditor.document.fileName.endsWith('.xml')) {
            vscode.window.showErrorMessage('Please open an XML file first');
            return;
        }

        const xmlPath = xmlEditor.document.uri.fsPath;
        const xsltUris = await vscode.window.showOpenDialog({
            filters: { 'XSLT Files': ['xsl', 'xslt'] },
            title: 'Select XSLT File',
            defaultUri: vscode.Uri.file(path.dirname(xmlPath))
        });
        if (!xsltUris || xsltUris.length === 0) {
            return;
        }

        const xsltPath = xsltUris[0].fsPath;
        const xsltContent = fs.readFileSync(xsltPath, 'utf8');
        const definedParams = extractXsltParameters(xsltContent);
        const outputPath = getOutputPath(xmlPath);
        const parameters = await collectDefinedParameters(context, definedParams);

        await executeTransform(context, xmlPath, xsltPath, outputPath, parameters);
    }));
}

function extractXsltParameters(xsltContent: string): string[] {
    const paramRegex = /<xsl:param\s+name="([^"]+)"(?:\s+select="([^"]*)")?/g;
    const params: string[] = [];
    let match;

    while ((match = paramRegex.exec(xsltContent)) !== null) {
        params.push(match[1]);
    }

    return params;
}

async function collectDefinedParameters(context: vscode.ExtensionContext, definedParams: string[]): Promise<XsltParameter[]> {
    const parameters: XsltParameter[] = [];
    const cachedParams = context.workspaceState.get<Record<string, string>>(PARAMETER_CACHE_KEY, {});

    for (const paramName of definedParams) {
        const paramValue = await vscode.window.showInputBox({
            prompt: `Enter value for parameter "${paramName}"`,
            placeHolder: 'value',
            value: cachedParams[paramName]
        });

        if (paramValue !== undefined) {
            parameters.push({ name: paramName, value: paramValue });
            cachedParams[paramName] = paramValue;
        }
    }

    context.workspaceState.update(PARAMETER_CACHE_KEY, cachedParams);
    return parameters;
}

function getOutputPath(xmlPath: string): string {
    const xmlDir = path.dirname(xmlPath);
    const xmlName = path.basename(xmlPath, '.xml');
    return path.join(xmlDir, `${xmlName}_transformed.xml`);
}

async function executeTransform(
    context: vscode.ExtensionContext,
    xmlPath: string,
    xsltPath: string,
    outputPath: string,
    parameters: XsltParameter[],
    xsltEditor?: vscode.TextEditor
) {
    const dotnetExePath = path.join(context.extensionPath, 'dotnet', 'XsltTransformer48', 'bin','release','net48', 'XsltTransformer48.exe');

    if (!fs.existsSync(dotnetExePath)) {
        vscode.window.showErrorMessage('XSLT Transformer not found. Please build the .NET component first.');
        return;
    }

    const args = [xmlPath, xsltPath, outputPath];
    // Add parameters as name=value
    parameters.forEach(param => {
        args.push(`${param.name}=${param.value}`);
    });    

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running XSL Transformation',
        cancellable: false
    }, async () => {
        return new Promise<void>((resolve) => {
            const child = cp.spawn(dotnetExePath, args);

            let errorOutput = '';
            let errorDetails: ErrorDetails = {};

            child.stderr.on('data', (data) => {
                const output = data.toString();
                errorOutput += output;

                if (output.startsWith('XSLT COMPILE ERROR') || output.startsWith('XML ERROR') || output.startsWith('XSLT TRANSFORM ERROR')) {
                    errorDetails.type = output.split('\n')[0];
                } else if (output.startsWith('Line: ')) {
                    const lineNum = parseInt(output.replace('Line: ', '').trim());
                    if (!isNaN(lineNum)) {errorDetails.line = lineNum;}
                } else if (output.startsWith('Position: ')) {
                    const posNum = parseInt(output.replace('Position: ', '').trim());
                    if (!isNaN(posNum)) {errorDetails.position = posNum;}
                } else if (output.startsWith('Message: ')) {
                    errorDetails.message = output.replace('Message: ', '').trim();
                } else if (output.startsWith('Source URI: ')) {
                    errorDetails.file = output.replace('Source URI: ', '').trim();
                }
            });

            child.on('close', async (code) => {
                if (code === 0) {
                    vscode.window.showInformationMessage('XSLT transformation successful!');
                    try {
                        const doc = await vscode.workspace.openTextDocument(outputPath);
                        vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                    } catch (e) {
                        vscode.window.showErrorMessage(`Failed to open output file: ${e instanceof Error ? e.message : String(e)}`);
                    }
                } else {
                    // Include the code in errorDetails
                    const errorDetailsWithCode: ErrorDetails = {
                        ...errorDetails,
                        code: code ?? undefined // Convert null to undefined
                    };
                    
                    await handleTransformationError(
                        errorOutput,
                        errorDetailsWithCode,
                        xsltPath,
                        xsltEditor
                    );
                }
                resolve();
            });
        });
    });
}

async function handleTransformationError(
    errorOutput: string,
    errorDetails: ErrorDetails,
    xsltPath: string,
    xsltEditor?: vscode.TextEditor
) {
    let errorMessage = 'XSLT Transformation Failed';
    const errorType = errorDetails.type ?? 'XSLT Error';
    const errorCode = errorDetails.code !== undefined ? ` (Code ${errorDetails.code})` : '';
    
    if (errorDetails.message) {
        errorMessage += `: ${errorDetails.message}`;
    }

    if (errorDetails.line !== undefined) {
        errorMessage += `\nLine: ${errorDetails.line}`;
        if (errorDetails.position !== undefined) {
            errorMessage += `, Position: ${errorDetails.position}`;
        }
    }

    const action = await vscode.window.showErrorMessage(
        errorMessage, 
        'Show Details', 
        'Open XSLT File'
    );

    if (action === 'Show Details') {
        const panel = vscode.window.createOutputChannel('XSLT Transformation Error');
        panel.appendLine(`${errorType}${errorCode}`);
        panel.appendLine(`File: ${errorDetails.file ?? xsltPath}`);
        if (errorDetails.line !== undefined) {
            panel.appendLine(`Location: Line ${errorDetails.line}` + 
                (errorDetails.position !== undefined ? `, Position ${errorDetails.position}` : ''));
        }
        panel.appendLine(`Message: ${errorDetails.message ?? errorOutput}`);
        panel.appendLine('\nFull Error Output:');
        panel.appendLine(errorOutput);
        panel.show();
    }

    if (errorDetails.line !== undefined && (action === 'Open XSLT File' || action === undefined)) {
        const targetFile = errorDetails.file ?? xsltPath;
        try {
            const doc = await vscode.workspace.openTextDocument(targetFile);
            const editor = await vscode.window.showTextDocument(doc);
            
            const line = errorDetails.line !== undefined ? Math.max(0, errorDetails.line - 1) : 0;
            const pos = errorDetails.position !== undefined ? Math.max(0, errorDetails.position - 1) : 0;
            
            const position = new vscode.Position(line, pos);
            
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        } catch (e) {
            console.error('Failed to navigate to error location:', e);
        }
    }
}

export function deactivate() {}