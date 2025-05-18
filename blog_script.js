let posts = [];

function submitPost() {
  const username = document.getElementById("username").value.trim();
  const content = document.getElementById("postContent").value.trim();

  if (!username || !content) {
    alert("Please enter your name and a message.");
    return;
  }

  const post = {
    id: Date.now(),
    user: username,
    content,
    date: new Date().toLocaleString(),
    likes: 0,
    comments: []
  };

  posts.unshift(post); // Add to top
  document.getElementById("postContent").value = "";
  renderPosts();
}

function likePost(id) {
  const post = posts.find(p => p.id === id);
  post.likes++;
  renderPosts();
}

function addComment(id, inputId) {
  const commentInput = document.getElementById(inputId);
  const commentText = commentInput.value.trim();
  const user = document.getElementById("username").value.trim();

  if (!commentText || !user) {
    alert("Enter your name and comment.");
    return;
  }

  const post = posts.find(p => p.id === id);
  post.comments.push({
    text: commentText,
    user,
    date: new Date().toLocaleString()
  });

  commentInput.value = "";
  renderPosts();
}

function renderPosts() {
  const container = document.getElementById("postsContainer");
  container.innerHTML = "";

  posts.forEach(post => {
    const postEl = document.createElement("div");
    postEl.className = "post";

    postEl.innerHTML = `
      <p><strong>${post.user}</strong></p>
      <p class="info">${post.date}</p>
      <p>${post.content}</p>
      <button class="like-btn" onclick="likePost(${post.id})">👍 Like (${post.likes})</button>

      <div class="comment-input">
        <input type="text" id="comment-${post.id}" placeholder="Write a comment..." />
        <button onclick="addComment(${post.id}, 'comment-${post.id}')">Comment</button>
      </div>

      ${post.comments.length ? `
        <div class="comments">
          <p><strong>Comments:</strong></p>
          ${post.comments.map(c => `
            <p><strong>${c.user}</strong> (${c.date}): ${c.text}</p>
          `).join("")}
        </div>
      ` : ""}
    `;

    container.appendChild(postEl);
  });
}
