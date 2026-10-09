package main

import (
	"os"
	"text/template"
)

func main() {
	content, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	hooks, err := template.New("hooks").Funcs(template.FuncMap{"getenv": os.Getenv}).Parse(string(content))
	if err != nil {
		panic(err)
	}
	if err := hooks.Execute(os.Stdout, nil); err != nil {
		panic(err)
	}
}
