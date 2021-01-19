# voorhees-github-action

This action runs [Voorhees](https://github.com/Nivl/voorhees) and reports dependency issues.

## Inputs

### `version`

Version of Voorhees to use in form of v1.2 or v1.2.3 or `latest` to use the latest version. Default is `latest`.

### `goListFile`

Path to a file containing the output of `go list -m -u -json all` command. Default is `go.list`.

## Example usage

### With defaults

```
voorhees:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-go@v2

    - name: Generate go.list
      run: go list -json -m all > go.list

    - name: Run Voorhees
      uses: Nivl/voorhees-github-action@v1
```

### With options

```
uses: actions/voorhees@v1
with:
    version: 1
    goListFile: go.list
```
