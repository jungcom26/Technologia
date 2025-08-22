import sys
from chroma_operations import query_chroma_db, display_results

def main():
    # Get query from command line arguments or prompt user
    if len(sys.argv) > 1:
        query_text = " ".join(sys.argv[1:])
    else:
        query_text = input("Enter your search query: ").strip()
    
    if not query_text:
        print("Please provide a search query!")
        return
    
    # Query the database
    results = query_chroma_db(query_text)
    
    # Display results
    display_results(results, query_text)

if __name__ == "__main__":
    main()