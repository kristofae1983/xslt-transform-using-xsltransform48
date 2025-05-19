# XSLT Transform using XslTransform48

A Visual Studio Code extension that performs XSLT transformations using .NET Framework 4.8's XslTransform class.

## Features

- Transform XML files using XSLT stylesheets
- Two convenient ways to initiate transformations:
  - From an open XSLT file (right-click or command palette)
  - From an open XML file (right-click or command palette)
- Automatic parameter detection from XSLT files
- Parameter value caching between transformations
- Detailed error reporting with:
  - Error message display
  - Line number navigation
  - Full error output view
- Automatic output file naming (appends `_transformed` to input filename)
- Opens transformed output in a new editor tab

## Requirements

- [.NET Framework 4.8 Runtime](https://dotnet.microsoft.com/download/dotnet-framework/net48) must be installed
- XML and XSLT files must be well-formed

## Usage

1. **From an XSLT file**:
   - Open your XSLT file
   - Right-click in the editor or use the command palette
   - Select "Transform XML using this XSLT"
   - Choose your input XML file
   - Enter any required parameter values when prompted

2. **From an XML file**:
   - Open your XML file
   - Right-click in the editor or use the command palette
   - Select "Transform XML with XSLT"
   - Choose your XSLT file
   - Enter any required parameter values when prompted

The transformed output will be saved as `[originalname]_transformed.xml` in the same directory as your input XML file and automatically opened in a new editor tab.

## Known Issues

- Large XML/XSLT files may cause performance issues
- Complex XSLT 2.0/3.0 features may not be supported (this uses .NET's XslTransform which is XSLT 1.0)
- Error line numbers may sometimes be slightly off

## Release Notes

### 0.0.4

-icon added 

### 0.0.3

-license added 

### 0.0.2

Initial release featuring:
- Basic XSLT 1.0 transformation capabilities
- Parameter support with value caching
- Error reporting and navigation
- Both XML and XSLT file initiation