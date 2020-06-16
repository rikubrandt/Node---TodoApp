
  
  get_untodos()
  
  function get_untodos() {
    var request = new XMLHttpRequest();
    var requestURL = '/get_taskhistory'
    request.open('GET', requestURL);
    request.responseType = 'json';
    request.send();
    request.onload = function() {
      var todos = request.response;
      printUnTodos(todos);
    }
  }
  
  function printUnTodos(todos) {
    var table = document.getElementById("todo_table")
    
    for (var i in todos) {
      const todo_id = todos[i].todo_id
      const todo = todos[i].task
      const dateCompleted = new Date(todos[i].date_complete).toLocaleString()
      
      var row = document.createElement("tr")
      var task_cell = document.createElement("td")
      var time_cell = document.createElement("td")
      var completionText = document.createTextNode(dateCompleted)
      todo_button = document.createElement("button")
      todo_button.setAttribute("onclick", "uncomplete_todo(" + todo_id + ")")
      todo_button.id = "uncomplete_todo_button"
      todo_button.className += "btn btn-light"
      todo_button.innerHTML = todo
      completionText.innerHTML = dateCompleted
      
      task_cell.append(todo_button)
      time_cell.append(completionText)
      
      row.append(task_cell)
      row.append(time_cell)
      table.append(row)
      
    }
  }
  
  
  function uncomplete_todo(todo_id) {
    var form = document.getElementById("uncomplete_todo_form")
    form.action = form.action + todo_id
    form.submit()
  }