we will build the full pruduct, build API for extracting the information from capture receipts images, and then a categorization of those receipts and how to show up on the app. we will build a db using Convex as well. what I want is to use telegram or slack where if I send a  picture takes care of everything and add it to the page.  so our focus for this round is build a backend that will run extraction, categorization, and the logic layer that governs how outputs are handled.

given that some of the processes can be long let's use python maybe? or is there a better option? 

for the extraction process I want to use OCR, but my issue is that this is for a bank so there is a lot of regulation around, we will need to think through how we want this to proceed. 

this is how I want the interaction to work:
- user send receipt picture to telegram or slack
- backend extracts the information,
    if information is clear, the right processes run. 
    if not we can pass it to an LLM to help our with indentification 
    if the LLMS is not 99% sure of the result, we send another message to the user on slack and ask them to send a clearer picture. 
- from there, we will now categorize the expense in the system.  and have it under the approvals (here I need your help to know if this is the best way to do it or not)

