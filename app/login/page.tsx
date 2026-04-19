export default function LoginPage() {
  return (
    <div className=\"min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50\">
      <div className=\"max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-2xl\">
        <div className=\"text-center\">
          <h2 className=\"text-3xl font-bold text-gray-900\">CEMMS Login</h2>
          <p className=\"mt-2 text-sm text-gray-600\">Green Initiative Program</p>
        </div>
        <form className=\"mt-8 space-y-6\">
          <div className=\"space-y-4\">
            <div>
              <label className=\"block text-sm font-medium text-gray-700\">Email</label>
              <input type=\"email\" className=\"mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm\" />
            </div>
            <div>
              <label className=\"block text-sm font-medium text-gray-700\">Password</label>
              <input type=\"password\" className=\"mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm\" />
            </div>
          </div>
          <button className=\"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700\">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
