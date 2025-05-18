import StudentBlog from './StudentBlog';

function App() {
  return (
    <div className="App">
      <StudentBlog />
    </div>
  );
}

export default App;


import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function StudentBlog() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [username, setUsername] = useState("");
  const [commentMap, setCommentMap] = useState({});

  const handlePost = () => {
    if (newPost.trim() && username.trim()) {
      const post = {
        id: Date.now(),
        content: newPost,
        user: username,
        date: new Date().toLocaleString(),
        likes: 0
      };
      setPosts([post, ...posts]);
      setNewPost("");
    }
  };

  const handleLike = (id) => {
    setPosts(
      posts.map(post => post.id === id ? { ...post, likes: post.likes + 1 } : post)
    );
  };

  const handleCommentChange = (id, comment) => {
    setCommentMap({ ...commentMap, [id]: comment });
  };

  const handleCommentSubmit = (id) => {
    const commentText = commentMap[id]?.trim();
    if (commentText) {
      setPosts(posts.map(post => {
        if (post.id === id) {
          const comments = post.comments || [];
          return {
            ...post,
            comments: [...comments, { text: commentText, user: username, date: new Date().toLocaleString() }]
          };
        }
        return post;
      }));
      setCommentMap({ ...commentMap, [id]: "" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">📚 Student Communication Blog</h1>

      <Card className="p-4">
        <CardContent className="space-y-2">
          <Input
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Textarea
            placeholder="Write your message here..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
          />
          <Button onClick={handlePost} className="w-full">
            Post Message
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold">{post.user}</p>
              <p className="text-sm text-gray-500">{post.date}</p>
              <p>{post.content}</p>
              <div className="flex gap-2 items-center">
                <Button size="sm" onClick={() => handleLike(post.id)}>👍 Like ({post.likes})</Button>
              </div>
              <div className="mt-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={commentMap[post.id] || ""}
                  onChange={(e) => handleCommentChange(post.id, e.target.value)}
                />
                <Button size="sm" className="mt-1" onClick={() => handleCommentSubmit(post.id)}>
                  Comment
                </Button>
              </div>
              {post.comments?.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="font-semibold">Comments:</p>
                  {post.comments.map((c, i) => (
                    <div key={i} className="text-sm pl-2 border-l-2 border-gray-300">
                      <p><strong>{c.user}</strong> <span className="text-xs text-gray-500">{c.date}</span></p>
                      <p>{c.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}