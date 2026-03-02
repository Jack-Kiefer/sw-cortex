# Weekly Dev Standup

Date: 2026-02-19

Invited: Anna Kifer, Munyr Ahmed, Bilal Ahmed, Parish Shrestha, Manish C, Aashish Shrestha, Subash Chaudhary, Seth Finley, Jack Kiefer

## Summary

The team, including Aashish Shrestha, Manish C, and Anna Kifer, discussed moving over 150 MB of CMS images to S3 to prevent data duplication on GitHub, with Anna Kifer suggesting Aashish Shrestha follow up with Manir. Parish Shrestha reported a successful penetration test in the local environment that uncovered and fixed a critical payment bypass issue, while Subash Chaudhary and Seth Finley planned to incrementally increase the new receiver flow traffic after a day of review. Bilal Ahmed updated the team on fixes to the e-card email bug and the deadlocks project, while Manish C reported the implementation of SQLite for unit testing, the planned separation of the blue environment database, and his assignment with Parish Shrestha to build an internal USPS label generation tool to replace Retool due to issues with duplicate labels and logging. Seth Finley granted all team members access to perform hot fixes with a strict protocol requiring posting in the devs-only channel and ensuring another team member is online.

## Details

### CMS Updates and Image Handling

Aashish Shrestha provided an update on working on the new CMS to make it live for Manish C and Muri. Aashish Shrestha raised a discussion point regarding handling images, specifically those from the live October CMS that are currently linked from the live database and code. They requested input on whether to keep the images in Laravel or move them to S3 and update the live database, noting they had already downloaded the images locally.

### Image Storage Recommendations

Manish C confirmed that there are over 150 MBs of image data and reported that Claude recommended saving the images in S3. Manish C explained that saving 150 MB of data in GitHub would cause a new server to pull that data every time it spins up, resulting in data duplication across multiple servers. Anna Kifer suggested discussing the matter with Manir due to a previous discussion about FX versus the CMS for file storage and recommended Aashish Shrestha start a Slack message and tag Manir.

### Bilal Ahmed's Updates

Bilal Ahmed reported that a couple of their tickets went live the previous day and that they are currently working on a bug related to the e-card email sent before e-cards are actually sent. They also mentioned discussing custom sleeves with Subash Chaudhary, as well as holding discussions regarding their components with Parish Shrestha and Subash Chaudhary. Anna Kifer reminded the team that updates only need to be provided for items that require team sharing, not a comprehensive list of tasks.

### Manish C's Head Start Credit Update

Manish C shared that they worked on sending the purchased credit amount to Claio when a whole-day head start is purchased, and this update is currently in the blue environment and scheduled for the next release. Anna Kifer clarified that this implementation was requested by Lindsay to track if people actually buy credits by sending the purchase credit amounts to Claio if BPS is enabled.

### Pentest Findings and Payment Bypass Issue

Parish Shrestha reported that the decision to execute the penetration test on the local environment first was successful, as it helped uncover a payment bypass issue that might not have been found on manage or live environments. The fix for the payment bypass issue has been pushed to manage and blue, and they plan to hard fix it on live once testing on blue is complete. Parish Shrestha confirmed that the payment bypass exploit involved a post request in the cart and did not require a suite of pentest tools.

### Pentesting Tools Discussion

Seth Finley questioned if Claude uses or could use other pentest tools, to which Parish Shrestha responded that they thought only Playwright, which uses Chrome, could be used. Anna Kifer recalled sending an article that might suggest Claude could use other tools, and Parish Shrestha mentioned finding one site called Sim Grip that does a thorough scan. Parish Shrestha committed to looking into the use of advanced tools and providing an update.

### Subash Chaudhary's Updates

Subash Chaudhary reported fixing a couple of bugs related to the new receiver flow, including the issue where buyer order confirmation emails were not being sent. They also confirmed that the receiver flow redirect has been turned back on as of that morning, currently routing 50% of traffic. Subash Chaudhary is also working on storing logs into the FSX so that they are accessible even if the server is down, which Manish C suggested would allow access via SSH from the manage server.

### Receiver Flow Traffic Increase Plan

Anna Kifer inquired about the next steps for increasing receiver flow traffic, and Subash Chaudhary suggested waiting a day to review orders for any issues before increasing traffic. Seth Finley suggested the next steps would be 80% then 100%, and Subash Chaudhary agreed to those percentages.

### Jason's Approval for Client-Facing Content

Anna Kifer announced a new requirement for client-facing content and new designs on Laravel, stating that they need approval from Jason before pushing anything live. Developers should get content on manage and then post a screenshot in the original request thread or a new channel for Jason's approval before pushing to live, and Anna Kifer offered to review content before it is sent to Jason.

### Resuming EC Order Project

Anna Kifer directed the team to move forward with the rest of the EC order project, which involves moving data out of the EC order table into their own tables, and assigned Bilal Ahmed as the owner of the database aspects. Anna Kifer plans to schedule a short call with necessary participants to review the project status and put together a game plan. Seth Finley suggested considering other tables alongside EC order, such as the gift cards table, which Anna Kifer agreed should be planned but noted the EC order project is already outlined and easier to move forward with immediately.

### USPS Label Creation Workflow

Seth Finley remembered an update regarding the USPS label creation retool workflow, stating there are issues with it and that the team should look into building it themselves due to problems with retool's handling of logging and failures. Anna Kifer added the USPS label generation to the issues list.

### Custom Sleeves Printing Discussion

Anna Kifer introduced a discussion regarding the custom sleeves printing process for ops, especially how to provide ops with the image to print when a receiver order is placed before the sleeves are printed. Subash Chaudhary had proposed two options: scanning a barcode that looks up the S3 image in the branding table, or moving the image into a different bucket when a receiver order is placed and looking it up by order ID.

### Custom Sleeves Image Update Process

The discussion focused on how to handle updates to custom sleeve images stored in the Wish Desk database, which are in S3. Jack Kiefer confirmed that the exact image in S3 could be updated and the original could be archived. Anna Kifer determined that copying the image upon receiver order placement would not work because subsequent image updates would not be reflected in the copied image. Jack Kiefer agreed that copying the image should be avoided to prevent issues similar to those found with mugs, where multiple copies require multiple updates.

### Barcode Scanning for Custom Sleeves

The conclusion was that scanning the barcode must go to the JSON record in the branding table to retrieve the most recently updated S3 image. Anna Kifer suggested the barcode should be generated to link to the branding record, and Subash Chaudhary proposed the barcode could trigger an API request using the order ID to return the image URL. The consensus was that a call with Chris is needed to determine how ops processes the barcode and how to best implement the lookup functionality.

### SQLite Implementation for Unit Tests

Manish C confirmed that SQLite for unit testing is fully implemented on live and is running tests in parallel in approximately four minutes. They noted that a server for unit test coverage is set up but not working, and Monu could set it up easily. Manish C mentioned that Claude suggested against publishing the unit test coverage report on the web due to security risks and vulnerability exposure.

### Unit Test Coverage Report Access

Anna Kifer suggested moving the unit test coverage report to the admin interface so that only developers could view it for security reasons. Manish C agreed to work with Manir on moving the report to the admin interface. Seth Finley suggested that if the report needs to be rebuilt, they should ask Claude how to integrate it into Laravel for better utilization and insights, which Manish C is willing to attempt.

### Unit Testing on Blue Environment

The team discussed setting up unit testing on the blue environment to catch merge conflicts. Subash Chaudhary explained that unresolved conflicts sometimes get merged to blue, and running unit tests during the PR merge process would automatically fail the tests. Anna Kifer agreed that this is worth doing now that the unit tests run fast, and asked Manish C to work with Manir to implement this.

### Separating Blue from Live Database

Anna Kifer brought up finishing the process of decoupling the blue environment from the live database so that it has its own database for testing queues, crons, and lambda functions. The benefit is the ability to fully test the queue functionality, and Manish C agreed that having a separate setup makes sense for security and to prevent interference with live clients. The team decided to move forward with separating blue, and Manish C volunteered to own the project.

### Implementation of New Blue Environment

Manish C confirmed that test credentials would be used for Stripe and PayPal in the blue environment. Manish C was tasked with reaching out to Manir for updates on the ENV file and the new URL. Anna Kifer emphasized the need to test the new blue environment thoroughly before switching the domain (from B456 to B123) and suggested the switch should occur right after a release to allow a full week to address any issues.

### Modernizing API React Components

The discussion about modernizing API React components was revisited. Manish C reported that Claude suggested it is not currently necessary to spend time on this, as most UIs (corporate and consumer settings, preflow, wish link flow) are stable and do not have many changes, but suggested it could be done incrementally if needed. Anna Kifer suggested the team should consult with product to see if they want to update the components to React for a richer experience, though Seth Finley suggested that given the low usage of some components and the future move of buyer flow to proposals, they should not focus on it now. The team decided not to focus on modernizing API React for now.

### Deadlocks Project Action Plan

Bilal Ahmed provided an update on the deadlocks project, stating they need to make changes in the AWS RDS, specifically adding a flag to generate a log file to track where the deadlocks originate. This log file will enable them to create an action plan for fixing the issues.

### MCP Server Tools Discussion

Subash Chaudhary updated the team on the MCP server, confirming it has been helpful for debugging live issues but has not yet identified specific tools to implement. They mentioned the possibility of tools for reviewing the database or listing tables. Anna Kifer asked Subash Chaudhary to work with Bilal Ahmed to create a list of useful tools for setup.

### Multi-Environment Connectivity for MCP Server

Subash Chaudhary suggested a feature to allow the MCP server to connect to multiple databases simultaneously, including local and manage environments, which would aid testing and development by avoiding the need to switch credentials. Subash Chaudhary confirmed that Claude indicated this multi-connectivity feature is possible.

### Image Links and Database Updates

The team discussed options for updating image links in the live database, including having Subash Chaudhary use Claude with the current MCP to generate manual update queries for bulk changes. Manish C confirmed they looked into the custom CMS and that implementation is possible with minor changes. Anna Kifer considered this a worthwhile task, especially for the homepage.

### Custom Sleeves Update and Print Status

Subash Chaudhary confirmed that the image retention issue is the only major outstanding question for custom sleeves. Subash Chaudhary is unclear on how the Print Manager UI will update the printed status, but Anna Kifer noted that since the team will likely build the Print Manager, they will be able to figure that out. Subash Chaudhary suggested using a separate table for print statuses instead of JSON records for easier querying and updating.

### Database Normalization for Branding Field

Subash Chaudhary and Anna Kifer discussed the database structure concerning the branding field, specifically debating the benefits of creating a new, separate table versus adding an extra field to the existing table. Subash Chaudhary suggested that normalizing the database with a new table would prevent potential deadlocks if multiple columns were added in the near future, similar to the setup for gift cards. Anna Kifer directed Subash Chaudhary to discuss the downsides and benefits with Bilal Ahmed and Manish C, as they are involved with database-related topics, to determine the correct approach.

### Gift Card Billing Fields Update

Anna Kifer asked Bilal Ahmed to confirm if they had updated the billing gift card fields that needed to be added to a document. Bilal Ahmed confirmed that they had already added the necessary fields to the document.

### Live Releases and Hot Fixes Policy

The team discussed the process for live releases and hot fixes, with Seth Finley emphasizing the importance of team members being able to perform urgent hot fixes themselves. Seth Finley requested that if a team member performs a hot fix, they must have someone else online who understands the situation and is aware of the fix being deployed. Anna Kifer asked if team members who have hot fix access also need access to other functions like restarting queues.

### Access for Deployment and Testing

Parish Shrestha noted that safer hot fixes include reverting previous work and indicated that access to deploy to live would also be necessary. Subash Chaudhary, who is responsible for crons, requested access to the queue server for testing purposes. Anna Kifer agreed that access to the queue server and possibly write access to the database (for running queries) are necessary if they are pushing hot fixes related to those systems.

### Addressing Server Issues During Release

Manish C raised a potential issue where the site sometimes goes down when a new server spins up during a release, which could also happen during a hot fix. Bilal Ahmed suggested that running the deployment job a second time usually fixes the issue automatically. Bilal Ahmed confirmed that updating the deployment job to automatically check and trigger a second run would require discussion with Moner.

### Hot Fix Deployment Protocol

Seth Finley granted access for all team members to perform hot fixes but mandated a strict protocol requiring them to post in the devs-only channel before deployment and ensure another person is online. They also emphasized the need for testing the application pages and CMS after deployment to confirm everything is functioning correctly. Anna Kifer stressed that testing is always necessary for hot fixes because the code sometimes fails to deploy properly.

### Building an Internal Label Generation Solution

Seth Finley initiated a discussion about replacing the current label generation process managed by Retool due to issues with large logs, changing policies, and the resulting generation of duplicate labels. Seth Finley reported that $50,000 worth of duplicate labels were generated between November and January. The team agreed to build an internal solution on their own EC2 instances to gain better logging, control, and alerts.

### Assignment for Label Generation Project

Seth Finley assigned Manish C to conduct the initial research and present findings for building the new label generation tool. Anna Kifer suggested that Parish Shrestha collaborate with Manish C as a secondary resource on the project to ensure continuity and shared understanding of the planning and build process. The solution needs to work consistently, be easily fixable, and can utilize any programming language or setup, including Laravel or a standalone application, as long as it handles high throughput and uses the USPS API.

### Integration and Functionality of New Label Tool

Anna Kifer suggested utilizing a queue when an order is placed to handle the label generation process. Seth Finley noted that the new solution must incorporate existing bypass conditions for specific shipping types and handle label cancellation workflows. The team concluded that they need to build functionality to handle address-related issues where Nicole currently makes fixes in Retool.

### Data Storage and Future Planning for Label Tool

Seth Finley explained that the team needs to change how labels are stored in S3 to prevent overwriting, ensuring that older versions of the label are kept to avoid losing 10% on refunds for canceled labels. Anna Kifer suggested Manish C and Parish Shrestha should consult with Jack regarding whether the new label generation tool should be integrated into SERP, as Jack intends to move all operations functions to SERP. The team concluded that Manish C and Parish Shrestha can decide which of them will take the lead on building the tool.

## Action Items

- Anna Kifer will schedule a call with Jack Kiefer and Chris to figure out how the barcode scanning should work for custom sleeves.
- Manish C will work with Maner to set up unit testing on blue.
- Manish C will own the process of separating blue from the live database and get it to the finish line, starting by reviewing the ENV file documentation.
- Subash Chaudhary will figure out the downsides and benefits of creating a new table for custom sleeves and talk to Bilal Ahmed and Manish C about the right approach.
- Bilal Ahmed will talk to Moner about updating the deployment job to automatically run a second time if the first attempt fails.
- Seth Finley will send Manish C the retool link, the bypass workflow, and information on storing labels in S3 and keeping duplicate records.
- Manish C and Parish Shrestha will research building a label generation tool, present their findings, and decide who will lead the build.
