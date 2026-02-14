package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Println("DATABASE_URL environment variable is required")
		os.Exit(1)
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		fmt.Printf("Failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Check users table structure
	rows, err := db.Query(`
		SELECT column_name, data_type, is_nullable 
		FROM information_schema.columns 
		WHERE table_name = 'users' 
		ORDER BY ordinal_position
	`)
	if err != nil {
		fmt.Printf("Failed to query table structure: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()

	fmt.Println("Users table structure:")
	fmt.Println("Column Name\t\tData Type\t\tNullable")
	fmt.Println("-----------\t\t---------\t\t--------")

	for rows.Next() {
		var columnName, dataType, isNullable string
		if err := rows.Scan(&columnName, &dataType, &isNullable); err != nil {
			fmt.Printf("Error scanning row: %v\n", err)
			continue
		}
		fmt.Printf("%-20s\t%-20s\t%s\n", columnName, dataType, isNullable)
	}
}
