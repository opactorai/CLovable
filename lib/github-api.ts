export async function checkRepositoryAvailabilitySimple(
    token: string,
    owner: string,
    repoName: string
  ) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
  
    if (res.status === 404) {
      return { exists: false };
    }
  
    if (!res.ok) {
      throw new Error("GitHub API error");
    }
  
    return { exists: true };
  }
  