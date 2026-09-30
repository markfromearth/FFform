#!/bin/bash
# Modify index.css for body bg and grid

cat << 'CSS' >> src/index.css

@layer base {
  body {
    background-color: #0b1a38;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    background-position: center top;
    color: #ffffff;
  }
}
CSS

