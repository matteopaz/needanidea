# needanidea.xyz

This is a super minimal, startup-focused site to share startup ideas. 

# Overall design

Hyper minimal. Serif font. Entire page is greyscale, no colors / accent. 
White background, black text. Tasteful margins and padding. Centered content.

Inspiration:
https://www.zeynebnk.com/ (slightly less minimal than this, but along these lines)
https://www.lesswrong.com/ (aesthetically, but more minimal)

# Homepage (only page)

Simple header: "need an idea?"

List / feed of ideas, ordered by descending upvote count.
Each idea is just its content, the author, and an upvote count. upvote / downvote arrows are on the right.

# Ideas
Ideas are pulled/stored on server. 
An idea consists of just a string less than 100 characters in length. It's only other attributes are author (below 20 characters), and upvote count (int).

# Creating ideas

There is no auth. Anyone on the site can create an idea. There is a panel at the bottom of the page just for this. a little text box for content, another for author, and a button to post. After clicking post, captcha should verify before request is sent to server.

idea is just sent to the server as POST then.

# storing ideas
Use sqlite to store ideas as simply as possible.

