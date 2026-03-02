# Lindsay / Jack

Date: 2026-01-28

Invited: Jack Kiefer, Lindsay Monson

## Summary

Lindsay Monson met with Jack Kiefer to discuss automating manual data compilation tasks for performance reports, specifically pulling email and text performance data from Clavio and Google Analytics using Claude Code. Jack Kiefer suggested using the Clavio API and a standardized Multi-Cloud Platform (MCP) tool to automatically query and receive dynamic data, as well as the creation of a report that integrates Clavio and "live database data." Jack Kiefer also recommended that Lindsay Monson begin development by cloning the Wishes repository from GitHub using an IDE like Cursor and focusing on building tools within Wish Desk that streamline their internal tasks.

## Details

### Introduction to Claude Code and Data Compilation Challenges

Lindsay Monson opened the meeting, expressing that they are new to using Claude Code and its capabilities, and Jack Kiefer confirmed themself as a resource to discuss it. Lindsay Monson shared that their main goal is to automate manual data compilation tasks, specifically pulling email and text performance information from various sources like Clavio (for in-the-moment data) and Google Analytics (for conversion metrics) for holiday or weekly performance reports, which involves compiling spreadsheets and gathering email screenshots for Claude Code analysis. They explained that this manual process, where data is downloaded to their desktop, is time-consuming and could be improved.

### Automating Data Access with APIs and MCP Tools

Jack Kiefer suggested using Clavio's API to pull information automatically, which could be set up with credentials. They explained that to allow Claude Code to access the API, a standardized MCP (Multi-Cloud Platform) tool can be created that uses the Clavio API and credentials to query and receive responses, potentially making the data dynamic in a Google Sheet through a separate workflow tool like Naden. Lindsay Monson noted that their site likely already uses an API to connect to Clavio, mentioning a setup Jason completed involving a "quiz key property" for email subscribers, although Jack Kiefer did not see the API key in the environment variables.

### Integrating Clavio and Google Analytics Data

Lindsay Monson sought guidance on automating data pulls from both Clavio and Google Analytics, noting they do not trust Clavio's revenue data as it tends to overinflate. Jack Kiefer confirmed that it is possible to create a report that brings in Clavio data and "live database data" using API keys, though working with APIs can sometimes be complex and limiting. They advised that setting up these capabilities would require significant setup and understanding, suggesting it as a post-Valentine's Day goal, and offered to help Lindsay Monson with the process alongside Payton.

### Getting Started with Wish Desk Development

Jack Kiefer recommended starting by cloning the Wishes repository from GitHub and using an IDE like Cursor or VS Code, noting that Lindsay Monson already has Cursor set up. They offered to provide an introduction to the codebase, explaining that the Wishes codebase contains all the folders and files that build the application, and confirmed that it pulls data from the Laravel database but is separate from the actual site code. They further clarified that development should occur on a personal branch, followed by a pull request to the 'development' branch for testing on 'dev 2,' which is a safety layer before going to the 'live' branch.

### GitHub Workflow and Essential Files

Jack Kiefer explained that the GitHub workflow involves making a pull request to the development branch, often requiring approval from Parish via Slack messages. They also highlighted the utility of specific slash commands within Claude Code, such as `merge review`, which automatically creates a pull request, noting these commands are part of the codebase once cloned. Jack Kiefer emphasized the importance of the `.env` file, which stores sensitive information like API keys and passwords and should be added locally, and the `replicy.pm` file, which is useful for bypassing IP blocks to access the live database.

### MCP Tools and Database Access

Jack Kiefer detailed the role of MCP tools, such as the `MCP DB tool`, which is already set up to allow Claude Code to make read queries to the live database. They suggested creating an MCP tool for Clavio or any other source to allow Claude Code to read information and answer questions about that data. Jack Kiefer confirmed that Wish Desk has its own database, in addition to the Sugar Wish (live) and ODU databases, and that the MCP tools choose which database to access for queries.

### Retool and Future Development Focus

Lindsay Monson asked if Retool, used for data queries and dashboards, has been replaced by Wish Desk development. Jack Kiefer responded that while Retool is still utilized, new development is mostly happening in Wish Desk, which is generally easier to build in once set up and has the additional benefit of Claude Code's AI functionality, which Retool currently lacks in quality. Jack Kiefer advised Lindsay Monson to focus on building tools within Wish Desk that make their job easier, rather than on public-facing features or changes to the website's account setup or dashboard, as those are harder to modify because they involve the separate Laravel codebase.

### Public-Facing Features and Learning Recommendations

Jack Kiefer suggested that if Lindsay Monson wanted to create a feature like a corporate gifting occasions calendar, they could build it as a public-facing page on Wishesk, similar to the articles page, with data driven by the database. They advised that by editing the data in the database, the information available on the public page would update. For next steps, Jack Kiefer recommended learning GitHub terminology and understanding how it works, and then going through the time-consuming but essential process of setting up the codebase. They also noted that Macs are generally preferred for coding setup over PCs due to fewer issues.

## Suggested Next Steps

- Lindsay Monson will follow up with Jason about the Clavio API setup.
- Lindsay Monson will try to clone the repository for Wishes from GitHub.
- Lindsay Monson will learn GitHub terminology and understand how it works.
- Lindsay Monson will go through the setup process of setting up the codebase and making everything right.
- Lindsay Monson and Jack Kiefer will follow up on setting up the automated system for pulling Clavio and Google Analytics data after Valentine's Day and employee appreciation day.
